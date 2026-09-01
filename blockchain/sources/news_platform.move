/// MUBA AI Intelligence Marketplace — core on-chain module.
///
/// Kept ON-CHAIN:
///   * identity      — wallet ownership via tx sender / owned objects
///   * payment       — exact-price SUI payment, forwarded straight to the treasury
///   * access        — `ResearchAccess` object owned by the buyer
///   * subscription  — time-boxed `PremiumPass` object
///   * provenance    — report title + SHA-256 content hash + Walrus blob id
///
/// Kept OFF-CHAIN: the report text itself (stored on Walrus). Only its hash is
/// anchored here.
module blockchain::news_platform {
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::clock::Clock;
    use std::string::{Self, String};

    // ---- pricing / duration constants (MIST + milliseconds) -----------------

    /// 0.01 SUI.
    const SUBSCRIPTION_PRICE: u64 = 10_000_000;
    /// 0.005 SUI.
    const REPORT_PRICE: u64 = 5_000_000;
    /// 7 days.
    const SUBSCRIPTION_DURATION_MS: u64 = 7 * 24 * 60 * 60 * 1000;
    /// 7 days.
    const REPORT_ACCESS_DURATION_MS: u64 = 7 * 24 * 60 * 60 * 1000;

    // ---- error codes -------------------------------------------------------------

    /// Payment coin value did not equal the exact required price.
    const EIncorrectPayment: u64 = 1;
    /// Caller is not the owner of the pass being renewed.
    const ENotOwner: u64 = 2;
    /// A report with this content hash has already been registered.
    const EReportAlreadyExists: u64 = 3;

    // ---- objects --------------------------------------------------------------

    /// Shared singleton: platform-wide config plus the content-hash registry.
    public struct PlatformConfig has key {
        id: UID,
        treasury: address,
        subscription_price: u64,
        report_price: u64,
        subscription_duration_ms: u64,
        report_access_duration_ms: u64,
        /// content hash (raw bytes) -> ResearchReport object id
        report_registry: Table<vector<u8>, ID>,
    }

    /// Capability to register reports and change settings. Held by the
    /// admin/back-end wallet only — never shipped to the frontend.
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Time-boxed "all reports" subscription, owned by the subscriber.
    public struct PremiumPass has key, store {
        id: UID,
        owner: address,
        expires_at: u64,
    }

    /// On-chain provenance for one AI intelligence report. The body is NOT here —
    /// only the hash and the Walrus blob id.
    public struct ResearchReport has key, store {
        id: UID,
        title: String,
        content_hash: String,
        walrus_blob_id: String,
        creator: address,
        created_at: u64,
    }

    /// Proof that `owner` bought time-boxed access to `report_id`.
    public struct ResearchAccess has key, store {
        id: UID,
        report_id: ID,
        owner: address,
        purchased_at: u64,
        expires_at: u64,
    }

    // ---- events -------------------------------------------------------------

    public struct SubscriptionPurchased has copy, drop {
        user: address,
        expires_at: u64,
        amount: u64,
    }

    public struct ReportRegistered has copy, drop {
        report_id: ID,
        creator: address,
    }

    public struct ReportPurchased has copy, drop {
        report_id: ID,
        buyer: address,
        expires_at: u64,
        amount: u64,
    }

    // ---- init -------------------------------------------------------------------

    /// Runs once at publish: shares the config, sends the `AdminCap` to the publisher.
    fun init(ctx: &mut TxContext) {
        let publisher = ctx.sender();

        let config = PlatformConfig {
            id: object::new(ctx),
            treasury: publisher,
            subscription_price: SUBSCRIPTION_PRICE,
            report_price: REPORT_PRICE,
            subscription_duration_ms: SUBSCRIPTION_DURATION_MS,
            report_access_duration_ms: REPORT_ACCESS_DURATION_MS,
            report_registry: table::new<vector<u8>, ID>(ctx),
        };
        transfer::share_object(config);

        transfer::public_transfer(AdminCap { id: object::new(ctx) }, publisher);
    }

    // ---- subscription -----------------------------------------------------------

    /// Buy a fresh `PremiumPass`. `payment` must equal the subscription price exactly.
    public entry fun subscribe(
        config: &PlatformConfig,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&payment);
        assert!(amount == config.subscription_price, EIncorrectPayment);

        let buyer = ctx.sender();
        let expires_at = clock.timestamp_ms() + config.subscription_duration_ms;

        transfer::public_transfer(payment, config.treasury);
        transfer::public_transfer(
            PremiumPass { id: object::new(ctx), owner: buyer, expires_at },
            buyer,
        );

        event::emit(SubscriptionPurchased { user: buyer, expires_at, amount });
    }

    /// Extend an existing pass. Only the pass owner may call this.
    public entry fun renew(
        config: &PlatformConfig,
        pass: &mut PremiumPass,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == pass.owner, ENotOwner);

        let amount = coin::value(&payment);
        assert!(amount == config.subscription_price, EIncorrectPayment);

        let now = clock.timestamp_ms();
        let base = if (pass.expires_at > now) pass.expires_at else now;
        pass.expires_at = base + config.subscription_duration_ms;

        transfer::public_transfer(payment, config.treasury);
        event::emit(SubscriptionPurchased { user: pass.owner, expires_at: pass.expires_at, amount });
    }

    // ---- reports --------------------------------------------------------------

    /// Admin-only: anchor a new report's provenance on-chain. Rejects duplicate hashes.
    public entry fun register_report(
        _: &AdminCap,
        config: &mut PlatformConfig,
        title: vector<u8>,
        content_hash: vector<u8>,
        walrus_blob_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(
            !table::contains(&config.report_registry, content_hash),
            EReportAlreadyExists,
        );

        let creator = ctx.sender();
        let report = ResearchReport {
            id: object::new(ctx),
            title: string::utf8(title),
            content_hash: string::utf8(content_hash),
            walrus_blob_id: string::utf8(walrus_blob_id),
            creator,
            created_at: clock.timestamp_ms(),
        };
        let report_id = object::id(&report);

        table::add(&mut config.report_registry, content_hash, report_id);
        transfer::share_object(report);

        event::emit(ReportRegistered { report_id, creator });
    }

    /// Buy time-boxed access to a single report. `payment` must equal the report
    /// price exactly.
    public entry fun purchase_report(
        config: &PlatformConfig,
        report: &ResearchReport,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&payment);
        assert!(amount == config.report_price, EIncorrectPayment);

        let buyer = ctx.sender();
        let now = clock.timestamp_ms();
        let expires_at = now + config.report_access_duration_ms;
        let report_id = object::id(report);

        transfer::public_transfer(payment, config.treasury);
        transfer::public_transfer(
            ResearchAccess {
                id: object::new(ctx),
                report_id,
                owner: buyer,
                purchased_at: now,
                expires_at,
            },
            buyer,
        );

        event::emit(ReportPurchased { report_id, buyer, expires_at, amount });
    }

    // ---- admin --------------------------------------------------------------

    /// Admin-only: point the treasury at a new address.
    public entry fun update_treasury(
        _: &AdminCap,
        config: &mut PlatformConfig,
        new_treasury: address,
    ) {
        config.treasury = new_treasury;
    }

    // ---- read helpers -----------------------------------------------------------

    public fun subscription_is_active(pass: &PremiumPass, clock: &Clock): bool {
        clock.timestamp_ms() < pass.expires_at
    }

    public fun access_is_active(access: &ResearchAccess, clock: &Clock): bool {
        clock.timestamp_ms() < access.expires_at
    }

    // ---- test-only ------------------------------------------------------------

    #[test_only]
    /// Invoke the private `init` from tests.
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun pass_expiry(pass: &PremiumPass): u64 { pass.expires_at }

    #[test_only]
    public fun access_owner(access: &ResearchAccess): address { access.owner }

    #[test_only]
    public fun access_report_id(access: &ResearchAccess): ID { access.report_id }
}
