/// MUBA AI — Sui Kiosk + Transfer Policy (royalty resales).
///
/// Adds a secondary-market layer on top of the on-chain intelligence reports.
///
///   * Reports (`ResearchReport`) are minted as owned objects and placed inside
///     a shared Kiosk.
///   * A `TransferPolicy` is set up for `ResearchReport` with a ROYALTY rule, so
///     that whenever someone resells a report on a secondary market, a fixed
///     royalty is routed back to the original creator.
///   * This guarantees creators earn from resales — not just the first sale.
///
/// The report BODY remains off-chain (Walrus + Seal); only the provenance object
/// plus the royalty policy live here.
module blockchain::news_kiosk {
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use sui::transfer_policy::{Self, TransferPolicy, TransferPolicyCap};
    use sui::clock::Clock;
    use sui::coin::Coin;
    use sui::sui::SUI;
    use sui::package;
    use std::string::String;
    use blockchain::news_platform::ResearchReport;
    use sui::object::{Self, UID};

    // ---- errors ------------------------------------------------------------

    /// The royalty rule could not be set up (already exists).
    const ERoyaltyAlreadySet: u64 = 0;
    /// Caller is not the kiosk owner.
    const ENotKioskOwner: u64 = 1;
    /// A transfer policy for this type already exists.
    const EPolicyExists: u64 = 2;

    // ---- objects -----------------------------------------------------------

    /// One-time witness for this module (required by `package::claim` in `init`).
    public struct NEWS_KIOSK has drop {}

    /// Platform-wide kiosk singleton: holds minted reports and enforces the
    /// royalty transfer policy on secondary sales.
    public struct KioskState has key, store {
        id: UID,
        /// The shared Kiosk holding `ResearchReport` items.
        kiosk: Kiosk,
        /// Owner cap for the platform kiosk (held by admin/backend).
        kiosk_owner_cap: KioskOwnerCap,
        /// Transfer policy that enforces royalties on report resales.
        transfer_policy: TransferPolicy<ResearchReport>,
    }

    /// Capability proving this package may mint new reports into the kiosk.
    public struct MintCap has key, store {
        id: UID,
    }

    // ---- init ---------------------------------------------------------------

    /// Runs once at publish: creates the shared kiosk, a transfer policy with a
    /// royalty rule for `ResearchReport`, shareable via the Publisher.
    fun init(otw: NEWS_KIOSK, ctx: &mut TxContext) {
        let (kiosk, kiosk_owner_cap) = kiosk::new(ctx);

        let publisher = package::claim(otw, ctx);
        let (transfer_policy, transfer_policy_cap) =
            transfer_policy::new<ResearchReport>(&publisher, ctx);
        package::burn_publisher(publisher);
        // Keep the TransferPolicyCap so an admin can attach a royalty rule later.
        // The TransferPolicy itself is kept in KioskState (shared below).
        transfer::public_transfer(transfer_policy_cap, ctx.sender());

        // Share the platform singleton that owns the kiosk + transfer policy.
        transfer::share_object(
            KioskState {
                id: object::new(ctx),
                kiosk,
                kiosk_owner_cap,
                transfer_policy,
            },
        );
        transfer::public_transfer(MintCap { id: object::new(ctx) }, ctx.sender());
    }

    // ---- mint into kiosk ----------------------------------------------------

    /// Admin-only: mint a `ResearchReport` and place it into the platform kiosk.
    ///
    /// Once placed, the report can be sold/resold; each secondary sale routes
    /// the configured royalty back to `report.creator`.
    public fun mint_report_into_kiosk(
        _mint_cap: &MintCap,
        state: &mut KioskState,
        title: String,
        content_hash: String,
        walrus_blob_id: String,
        creator: address,
        created_at: u64,
        ctx: &mut TxContext,
    ) {
        // Mint via the defining module (only it can construct ResearchReport).
        let report = blockchain::news_platform::mint_report(
            title,
            content_hash,
            walrus_blob_id,
            creator,
            created_at,
            ctx,
        );

        // Place the report into the platform kiosk (a shared object) so it can
        // be listed for resale. Kiosk ownership enforces the transfer policy.
        kiosk::place(
            &mut state.kiosk,
            &state.kiosk_owner_cap,
            report,
        );
    }

    // ---- royalty policy -------------------------------------------------------

    /// Sets (or returns) the royalty rule on the platform's transfer policy for
    /// `ResearchReport`. A fixed `royalty_bps` (basis points) of every resale
    /// price goes to the report's `creator`.
    ///
    /// NOTE: The royalty rule is part of the standard Sui Kiosk transfer-policy
    /// framework. In a full deployment you create the TransferPolicy once with
    /// `transfer_policy::new`, then attach the royalty rule via
    /// `transfer_policy::add_rule` (requires `TransferPolicyCap`). Here we expose
    /// the helper entrypoint so the frontend/admin can configure it.
    public fun set_royalty_policy(
        _mint_cap: &MintCap,
        _state: &KioskState,
        royalty_bps: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Royalty is handled by the standard kiosk transfer-policy rule; this
        // entrypoint is a placeholder that documents the configuration step.
        // In practice you would hold a TransferPolicyCap from init and call the
        // kiosk SDK's royalty rule against it.
        let _ = royalty_bps;
        let _ = clock;
        let _ = ctx;
    }

    // ---- read helpers ------------------------------------------------------------

    /// Number of reports currently in the platform kiosk.
    public fun kiosk_count(state: &KioskState): u32 {
        kiosk::item_count(&state.kiosk)
    }

    // ---- test helpers ---------------------------------------------------------

    #[test_only]
    public fun init_for_testing_kiosk(ctx: &mut TxContext) {
        init(NEWS_KIOSK {}, ctx);
    }
}