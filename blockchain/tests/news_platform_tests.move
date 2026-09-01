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
    use sui::coin;
    use sui::sui::SUI;
    use sui::test_scenario as ts;

    const ADMIN: address = @0xAD;
    const ALICE: address = @0xA11CE;

    const SUBSCRIPTION_PRICE: u64 = 10_000_000;
    const REPORT_PRICE: u64 = 5_000_000;
    const WEEK_MS: u64 = 7 * 24 * 60 * 60 * 1000;

    #[test]
    fun subscribe_with_exact_payment_issues_pass() {
        let mut scenario = ts::begin(ADMIN);
        news_platform::init_for_testing(scenario.ctx());

        scenario.next_tx(ALICE);
        {
            let config = scenario.take_shared<PlatformConfig>();
            let clock = clock::create_for_testing(scenario.ctx()); // timestamp = 0
            let payment = coin::mint_for_testing<SUI>(SUBSCRIPTION_PRICE, scenario.ctx());

            news_platform::subscribe(&config, payment, &clock, scenario.ctx());

            clock::destroy_for_testing(clock);
            ts::return_shared(config);
        };

        scenario.next_tx(ALICE);
        {
            let pass = scenario.take_from_sender<PremiumPass>();
            assert!(news_platform::pass_expiry(&pass) == WEEK_MS, 0);
            scenario.return_to_sender(pass);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = news_platform::EIncorrectPayment)]
    fun subscribe_with_wrong_payment_aborts() {
        let mut scenario = ts::begin(ADMIN);
        news_platform::init_for_testing(scenario.ctx());

        scenario.next_tx(ALICE);
        let config = scenario.take_shared<PlatformConfig>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(1, scenario.ctx()); // wrong amount

        news_platform::subscribe(&config, payment, &clock, scenario.ctx());

        // Unreachable: subscribe aborts above. Kept so the module type-checks.
        clock::destroy_for_testing(clock);
        ts::return_shared(config);
        scenario.end();
    }

    #[test]
    fun purchase_report_gives_buyer_owned_access() {
        let mut scenario = ts::begin(ADMIN);
        news_platform::init_for_testing(scenario.ctx());

        // Admin registers a report.
        scenario.next_tx(ADMIN);
        {
            let cap = scenario.take_from_sender<AdminCap>();
            let mut config = scenario.take_shared<PlatformConfig>();
            let clock = clock::create_for_testing(scenario.ctx());

            news_platform::register_report(
                &cap,
                &mut config,
                b"BTC Intelligence Report",
                b"0000000000000000000000000000000000000000000000000000000000000000",
                b"walrus-blob-id-placeholder",
                &clock,
                scenario.ctx(),
            );

            clock::destroy_for_testing(clock);
            ts::return_shared(config);
            scenario.return_to_sender(cap);
        };

        // Alice buys access with the exact price.
        scenario.next_tx(ALICE);
        {
            let config = scenario.take_shared<PlatformConfig>();
            let report = scenario.take_shared<ResearchReport>();
            let clock = clock::create_for_testing(scenario.ctx());
            let payment = coin::mint_for_testing<SUI>(REPORT_PRICE, scenario.ctx());

            news_platform::purchase_report(&config, &report, payment, &clock, scenario.ctx());

            clock::destroy_for_testing(clock);
            ts::return_shared(report);
            ts::return_shared(config);
        };

        // Alice now owns a ResearchAccess pointing at that report.
        scenario.next_tx(ALICE);
        {
            let report = scenario.take_shared<ResearchReport>();
            let access = scenario.take_from_sender<ResearchAccess>();

            assert!(news_platform::access_owner(&access) == ALICE, 0);
            assert!(news_platform::access_report_id(&access) == object::id(&report), 1);

            scenario.return_to_sender(access);
            ts::return_shared(report);
        };

        scenario.end();
    }
}
