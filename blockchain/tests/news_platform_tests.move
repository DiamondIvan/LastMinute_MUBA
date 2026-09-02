#[test_only]
module blockchain::news_platform_tests {
    use blockchain::news_platform::{
        Self,
        PlatformConfig,
        PremiumPass,
        AdminCap,
        ResearchReport,
        ResearchAccess,
    };
    use sui::clock;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::test_scenario as ts;
    use std::string;

    const ADMIN: address = @0xAD; // publisher, therefore also the treasury
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    const SUBSCRIPTION_PRICE: u64 = 10_000_000;
    const REPORT_PRICE: u64 = 5_000_000;
    const DAY_MS: u64 = 24 * 60 * 60 * 1000;
    const WEEK_MS: u64 = 7 * 24 * 60 * 60 * 1000;

    const HASH_A: vector<u8> = b"aaaa000000000000000000000000000000000000000000000000000000000000";
    const HASH_B: vector<u8> = b"bbbb000000000000000000000000000000000000000000000000000000000000";

    // ---- helpers -------------------------------------------------------------

    /// Publishes the package: shares PlatformConfig, gives ADMIN the AdminCap.
    fun setup(): ts::Scenario {
        let mut scenario = ts::begin(ADMIN);
        news_platform::init_for_testing(scenario.ctx());
        scenario
    }

    /// ADMIN registers one report with the given hash, at time `now`.
    fun register_as_admin(scenario: &mut ts::Scenario, hash: vector<u8>, now: u64) {
        scenario.next_tx(ADMIN);
        let cap = scenario.take_from_sender<AdminCap>();
        let mut config = scenario.take_shared<PlatformConfig>();
        let mut clk = clock::create_for_testing(scenario.ctx());
        clock::set_for_testing(&mut clk, now);

        news_platform::register_report(
            &cap,
            &mut config,
            b"BTC Intelligence Report",
            hash,
            b"walrus-blob-id",
            &clk,
            scenario.ctx(),
        );

        clock::destroy_for_testing(clk);
        ts::return_shared(config);
        scenario.return_to_sender(cap);
    }

    /// `who` subscribes at time `now`.
    fun subscribe_at(scenario: &mut ts::Scenario, who: address, now: u64) {
        scenario.next_tx(who);
        let config = scenario.take_shared<PlatformConfig>();
        let mut clk = clock::create_for_testing(scenario.ctx());
        clock::set_for_testing(&mut clk, now);
        let payment = coin::mint_for_testing<SUI>(SUBSCRIPTION_PRICE, scenario.ctx());

        news_platform::subscribe(&config, payment, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        ts::return_shared(config);
    }

    // ================= SUBSCRIPTION =================

    #[test]
    fun subscribe_with_exact_payment_issues_pass() {
        let mut scenario = setup();
        subscribe_at(&mut scenario, ALICE, 0);

        scenario.next_tx(ALICE);
        {
            let pass = scenario.take_from_sender<PremiumPass>();
            assert!(news_platform::pass_owner(&pass) == ALICE, 0);
            assert!(news_platform::pass_expiry(&pass) == WEEK_MS, 1);
            scenario.return_to_sender(pass);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = news_platform::EIncorrectPayment)]
    fun subscribe_underpayment_aborts() {
        let mut scenario = setup();

        scenario.next_tx(ALICE);
        let config = scenario.take_shared<PlatformConfig>();
        let clk = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(SUBSCRIPTION_PRICE - 1, scenario.ctx());

        news_platform::subscribe(&config, payment, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        ts::return_shared(config);
        scenario.end();
    }

    /// Payment is exact-match by design: overpayment is rejected rather than
    /// silently kept.
    #[test]
    #[expected_failure(abort_code = news_platform::EIncorrectPayment)]
    fun subscribe_overpayment_aborts() {
        let mut scenario = setup();

        scenario.next_tx(ALICE);
        let config = scenario.take_shared<PlatformConfig>();
        let clk = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(SUBSCRIPTION_PRICE + 1, scenario.ctx());

        news_platform::subscribe(&config, payment, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        ts::return_shared(config);
        scenario.end();
    }

    /// No custody: the coin lands in the treasury in the same call, so the
    /// module never holds a balance and needs no withdraw function.
    #[test]
    fun subscribe_forwards_payment_to_treasury() {
        let mut scenario = setup();
        subscribe_at(&mut scenario, ALICE, 0);

        scenario.next_tx(ADMIN);
        {
            let paid = scenario.take_from_sender<Coin<SUI>>();
            assert!(coin::value(&paid) == SUBSCRIPTION_PRICE, 0);
            scenario.return_to_sender(paid);
        };

        scenario.end();
    }

    #[test]
    fun subscription_active_before_expiry_and_inactive_after() {
        let mut scenario = setup();
        subscribe_at(&mut scenario, ALICE, 0);

        scenario.next_tx(ALICE);
        {
            let pass = scenario.take_from_sender<PremiumPass>();
            let mut clk = clock::create_for_testing(scenario.ctx());

            clock::set_for_testing(&mut clk, WEEK_MS - 1);
            assert!(news_platform::subscription_is_active(&pass, &clk), 0);

            // Expiry is exclusive: active iff `now < expires_at`.
            clock::set_for_testing(&mut clk, WEEK_MS);
            assert!(!news_platform::subscription_is_active(&pass, &clk), 1);

            clock::set_for_testing(&mut clk, WEEK_MS + DAY_MS);
            assert!(!news_platform::subscription_is_active(&pass, &clk), 2);

            clock::destroy_for_testing(clk);
            scenario.return_to_sender(pass);
        };

        scenario.end();
    }

    /// Renewing while still active extends from the existing expiry, so the
    /// user never loses remaining time.
    #[test]
    fun renew_extends_from_existing_expiry() {
        let mut scenario = setup();
        subscribe_at(&mut scenario, ALICE, 0);

        scenario.next_tx(ALICE);
        {
            let config = scenario.take_shared<PlatformConfig>();
            let mut pass = scenario.take_from_sender<PremiumPass>();
            let mut clk = clock::create_for_testing(scenario.ctx());
            clock::set_for_testing(&mut clk, DAY_MS); // still active
            let payment = coin::mint_for_testing<SUI>(SUBSCRIPTION_PRICE, scenario.ctx());

            news_platform::renew(&config, &mut pass, payment, &clk, scenario.ctx());

            // old expiry + one week, NOT now + one week
            assert!(news_platform::pass_expiry(&pass) == WEEK_MS + WEEK_MS, 0);

            clock::destroy_for_testing(clk);
            scenario.return_to_sender(pass);
            ts::return_shared(config);
        };

        scenario.end();
    }

    /// Renewing an already-expired pass restarts from now, not from the stale expiry.
    #[test]
    fun renew_after_expiry_starts_from_now() {
        let mut scenario = setup();
        subscribe_at(&mut scenario, ALICE, 0);

        scenario.next_tx(ALICE);
        {
            let config = scenario.take_shared<PlatformConfig>();
            let mut pass = scenario.take_from_sender<PremiumPass>();
            let mut clk = clock::create_for_testing(scenario.ctx());
            clock::set_for_testing(&mut clk, 2 * WEEK_MS); // long expired
            let payment = coin::mint_for_testing<SUI>(SUBSCRIPTION_PRICE, scenario.ctx());

            news_platform::renew(&config, &mut pass, payment, &clk, scenario.ctx());

            assert!(news_platform::pass_expiry(&pass) == 2 * WEEK_MS + WEEK_MS, 0);

            clock::destroy_for_testing(clk);
            scenario.return_to_sender(pass);
            ts::return_shared(config);
        };

        scenario.end();
    }

    /// Even holding a reference to another wallet's pass, a different sender
    /// cannot renew it.
    #[test]
    #[expected_failure(abort_code = news_platform::ENotOwner)]
    fun renew_by_non_owner_aborts() {
        let mut scenario = setup();
        subscribe_at(&mut scenario, ALICE, 0);

        scenario.next_tx(BOB);
        let config = scenario.take_shared<PlatformConfig>();
        let mut pass = ts::take_from_address<PremiumPass>(&scenario, ALICE);
        let clk = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(SUBSCRIPTION_PRICE, scenario.ctx());

        news_platform::renew(&config, &mut pass, payment, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        ts::return_to_address(ALICE, pass);
        ts::return_shared(config);
        scenario.end();
    }

    // ================= CONTENT / PROVENANCE =================

    #[test]
    fun register_report_records_metadata() {
        let mut scenario = setup();
        register_as_admin(&mut scenario, HASH_A, 12_345);

        scenario.next_tx(ALICE);
        {
            let report = scenario.take_shared<ResearchReport>();

            assert!(
                news_platform::report_title(&report) == string::utf8(b"BTC Intelligence Report"),
                0,
            );
            assert!(news_platform::report_content_hash(&report) == string::utf8(HASH_A), 1);
            assert!(
                news_platform::report_walrus_blob_id(&report) == string::utf8(b"walrus-blob-id"),
                2,
            );
            // The registering wallet is recorded as creator, not the reader.
            assert!(news_platform::report_creator(&report) == ADMIN, 3);
            assert!(news_platform::report_created_at(&report) == 12_345, 4);

            ts::return_shared(report);
        };

        scenario.end();
    }

    /// The content-hash registry makes re-registering the same content impossible,
    /// so one piece of content has exactly one provenance record.
    #[test]
    #[expected_failure(abort_code = news_platform::EReportAlreadyExists)]
    fun duplicate_content_hash_aborts() {
        let mut scenario = setup();
        register_as_admin(&mut scenario, HASH_A, 0);
        register_as_admin(&mut scenario, HASH_A, 1); // same hash again
        scenario.end();
    }

    #[test]
    fun two_different_hashes_both_register() {
        let mut scenario = setup();
        register_as_admin(&mut scenario, HASH_A, 0);
        register_as_admin(&mut scenario, HASH_B, 1);

        scenario.next_tx(ADMIN);
        {
            let config = scenario.take_shared<PlatformConfig>();
            assert!(news_platform::config_registry_size(&config) == 2, 0);
            ts::return_shared(config);
        };

        scenario.end();
    }

    // ================= PURCHASE / ACCESS =================

    #[test]
    fun purchase_report_gives_buyer_owned_access() {
        let mut scenario = setup();
        register_as_admin(&mut scenario, HASH_A, 0);

        scenario.next_tx(ALICE);
        {
            let config = scenario.take_shared<PlatformConfig>();
            let report = scenario.take_shared<ResearchReport>();
            let clk = clock::create_for_testing(scenario.ctx());
            let payment = coin::mint_for_testing<SUI>(REPORT_PRICE, scenario.ctx());

            news_platform::purchase_report(&config, &report, payment, &clk, scenario.ctx());

            clock::destroy_for_testing(clk);
            ts::return_shared(report);
            ts::return_shared(config);
        };

        scenario.next_tx(ALICE);
        {
            let report = scenario.take_shared<ResearchReport>();
            let access = scenario.take_from_sender<ResearchAccess>();

            assert!(news_platform::access_owner(&access) == ALICE, 0);
            assert!(news_platform::access_report_id(&access) == object::id(&report), 1);
            assert!(news_platform::access_purchased_at(&access) == 0, 2);
            assert!(news_platform::access_expiry(&access) == WEEK_MS, 3);

            scenario.return_to_sender(access);
            ts::return_shared(report);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = news_platform::EIncorrectPayment)]
    fun purchase_report_wrong_price_aborts() {
        let mut scenario = setup();
        register_as_admin(&mut scenario, HASH_A, 0);

        scenario.next_tx(ALICE);
        let config = scenario.take_shared<PlatformConfig>();
        let report = scenario.take_shared<ResearchReport>();
        let clk = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(REPORT_PRICE / 2, scenario.ctx());

        news_platform::purchase_report(&config, &report, payment, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        ts::return_shared(report);
        ts::return_shared(config);
        scenario.end();
    }

    #[test]
    fun purchase_forwards_payment_to_treasury() {
        let mut scenario = setup();
        register_as_admin(&mut scenario, HASH_A, 0);

        scenario.next_tx(ALICE);
        {
            let config = scenario.take_shared<PlatformConfig>();
            let report = scenario.take_shared<ResearchReport>();
            let clk = clock::create_for_testing(scenario.ctx());
            let payment = coin::mint_for_testing<SUI>(REPORT_PRICE, scenario.ctx());

            news_platform::purchase_report(&config, &report, payment, &clk, scenario.ctx());

            clock::destroy_for_testing(clk);
            ts::return_shared(report);
            ts::return_shared(config);
        };

        scenario.next_tx(ADMIN);
        {
            let paid = scenario.take_from_sender<Coin<SUI>>();
            assert!(coin::value(&paid) == REPORT_PRICE, 0);
            scenario.return_to_sender(paid);
        };

        scenario.end();
    }

    #[test]
    fun access_active_then_expires() {
        let mut scenario = setup();
        register_as_admin(&mut scenario, HASH_A, 0);

        scenario.next_tx(ALICE);
        {
            let config = scenario.take_shared<PlatformConfig>();
            let report = scenario.take_shared<ResearchReport>();
            let clk = clock::create_for_testing(scenario.ctx());
            let payment = coin::mint_for_testing<SUI>(REPORT_PRICE, scenario.ctx());

            news_platform::purchase_report(&config, &report, payment, &clk, scenario.ctx());

            clock::destroy_for_testing(clk);
            ts::return_shared(report);
            ts::return_shared(config);
        };

        scenario.next_tx(ALICE);
        {
            let access = scenario.take_from_sender<ResearchAccess>();
            let mut clk = clock::create_for_testing(scenario.ctx());

            clock::set_for_testing(&mut clk, WEEK_MS - 1);
            assert!(news_platform::access_is_active(&access, &clk), 0);

            clock::set_for_testing(&mut clk, WEEK_MS);
            assert!(!news_platform::access_is_active(&access, &clk), 1);

            clock::destroy_for_testing(clk);
            scenario.return_to_sender(access);
        };

        scenario.end();
    }

    // ================= ADMIN / ACCESS CONTROL =================

    /// Holding the AdminCap is what authorises config changes.
    ///
    /// The negative case has no runtime test: `register_report` and
    /// `update_treasury` take `&AdminCap`, so a caller without that object
    /// cannot construct the call at all. Authorisation is enforced by the type
    /// system, not by a checked condition.
    #[test]
    fun admin_can_update_treasury() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut config = scenario.take_shared<PlatformConfig>();

            assert!(news_platform::config_treasury(&config) == ADMIN, 0);
            news_platform::update_treasury(&cap, &mut config, BOB);
            assert!(news_platform::config_treasury(&config) == BOB, 1);

            ts::return_shared(config);
            scenario.return_to_sender(cap);
        };

        scenario.end();
    }

    /// After the treasury moves, payments follow it.
    #[test]
    fun payments_follow_updated_treasury() {
        let mut scenario = setup();

        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut config = scenario.take_shared<PlatformConfig>();
            news_platform::update_treasury(&cap, &mut config, BOB);
            ts::return_shared(config);
            scenario.return_to_sender(cap);
        };

        subscribe_at(&mut scenario, ALICE, 0);

        scenario.next_tx(BOB);
        {
            let paid = scenario.take_from_sender<Coin<SUI>>();
            assert!(coin::value(&paid) == SUBSCRIPTION_PRICE, 0);
            scenario.return_to_sender(paid);
        };

        scenario.end();
    }
}
