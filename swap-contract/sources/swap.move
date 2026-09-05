/// MUBA — real SUI <-> TestUSD swap.
///
/// This is a SEPARATE package from `news_platform`, deployed independently, so
/// none of `news_platform`'s existing object ids (PlatformConfig, the demo
/// ResearchReport, the AdminCap already in use) are touched by this. See
/// docs/SECURITY.md and the AI-signal trading feature for the context this
/// was built to serve: an "Approve" click on an AI-suggested trade previously
/// only wrote to a simulated JSON ledger, because no swap contract existed
/// anywhere in this project and DeepBook's testnet pools have zero liquidity.
/// This module is the first genuinely real swap this project has.
///
/// Design, deliberately kept small:
///   * `TESTUSD` is a coin type this module fully owns (holds the
///     `TreasuryCap`) — minted on demand, so a SUI -> TestUSD swap can never
///     fail for lack of TestUSD supply.
///   * The reverse direction, TestUSD -> SUI, pays out of an accumulated SUI
///     reserve built up from prior SUI -> TestUSD swaps. Native SUI cannot be
///     minted, so this direction genuinely can run out of liquidity and
///     aborts rather than silently succeed — that asymmetry is real, not a
///     bug, and is exactly the kind of constraint a fixed-mint side-currency
///     swap should have.
///   * Price is oracle-style: an admin-gated `update_price` call pushes the
///     current SUI/USD price (the same number DefiLlama/DeepBook already
///     feed the rest of this app) on-chain. There is no on-chain price
///     discovery here on purpose — that's a full AMM's job, out of scope for
///     what this needed to prove.
#[allow(lint(self_transfer))]
module swap_contract::swap {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::coin_registry;
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::Clock;
    use std::string;

    // ---- constants ----------------------------------------------------------

    /// TestUSD has 6 decimals, matching real USDC's convention.
    const TESTUSD_DECIMALS: u8 = 6;
    /// SUI has 9 decimals (fixed, native).
    const SUI_DECIMALS_FACTOR: u128 = 1_000_000_000;

    // ---- error codes ----------------------------------------------------------

    /// The swap contract's SUI reserve can't cover a TestUSD -> SUI request.
    /// Native SUI can't be minted, so this is a real, not simulated, limit.
    const EInsufficientSuiLiquidity: u64 = 1;
    /// `update_price` was called with a zero price, which would make every
    /// swap either free or divide-by-zero.
    const EInvalidPrice: u64 = 2;

    // ---- objects ----------------------------------------------------------------

    /// One-time witness for creating the TESTUSD currency. Must match the
    /// module name uppercased, per Sui's coin-creation convention.
    public struct SWAP has drop {}

    /// Admin capability — gates price updates and reserve withdrawal by the
    /// deployer only. Mirrors news_platform.move's AdminCap pattern, but is
    /// its own type since this is a separate package.
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Shared singleton holding the mint authority, the accumulated SUI
    /// reserve, and the current oracle price.
    public struct SwapConfig has key {
        id: UID,
        treasury_cap: TreasuryCap<SWAP>,
        sui_reserve: Balance<SUI>,
        /// USD price of 1 whole SUI, scaled by 10^6 (e.g. $0.7598 -> 759800).
        price_usd_micros: u64,
        last_updated_ms: u64,
    }

    // ---- events ----------------------------------------------------------------

    public struct PriceUpdated has copy, drop {
        price_usd_micros: u64,
        updated_at_ms: u64,
    }

    public struct SwappedSuiToTestUsd has copy, drop {
        user: address,
        sui_in: u64,
        testusd_out: u64,
        price_usd_micros: u64,
    }

    public struct SwappedTestUsdToSui has copy, drop {
        user: address,
        testusd_in: u64,
        sui_out: u64,
        price_usd_micros: u64,
    }

    // ---- init ----------------------------------------------------------------

    /// Runs once at publish: creates the TESTUSD currency, shares the config
    /// with an initial price of exactly zero (deliberately invalid — see
    /// EInvalidPrice), and sends the AdminCap to the publisher. A real price
    /// must be pushed via `update_price` before any swap can succeed.
    fun init(witness: SWAP, ctx: &mut TxContext) {
        let publisher = ctx.sender();

        // coin_registry::new_currency_with_otw, not the deprecated
        // coin::create_currency: it hands back the TreasuryCap directly and
        // we deliberately never call make_supply_fixed/make_supply_burn_only,
        // so the cap stays free to mint AND burn for as long as this module
        // holds it - required for both swap directions.
        let (init_builder, treasury_cap) = coin_registry::new_currency_with_otw(
            witness,
            TESTUSD_DECIMALS,
            string::utf8(b"TESTUSD"),
            string::utf8(b"Test USD"),
            string::utf8(b"MUBA demo stablecoin, minted on demand by the SUI <-> TestUSD swap contract. Testnet play money only."),
            string::utf8(b""),
            ctx,
        );
        // No further metadata updates are needed after publish, so the
        // MetadataCap is deleted immediately rather than left for someone to
        // hold onto.
        coin_registry::finalize_and_delete_metadata_cap(init_builder, ctx);

        let config = SwapConfig {
            id: object::new(ctx),
            treasury_cap,
            sui_reserve: balance::zero<SUI>(),
            price_usd_micros: 0,
            last_updated_ms: 0,
        };
        transfer::share_object(config);

        transfer::public_transfer(AdminCap { id: object::new(ctx) }, publisher);
    }

    // ---- admin ----------------------------------------------------------------

    /// Pushes the current SUI/USD price on-chain. Admin-only: this is the
    /// oracle input every swap prices off, so only the deployer/backend
    /// service (holding the AdminCap) may set it.
    public fun update_price(
        config: &mut SwapConfig,
        new_price_usd_micros: u64,
        clock: &Clock,
        _: &AdminCap,
    ) {
        assert!(new_price_usd_micros > 0, EInvalidPrice);
        config.price_usd_micros = new_price_usd_micros;
        config.last_updated_ms = clock.timestamp_ms();
        event::emit(PriceUpdated {
            price_usd_micros: new_price_usd_micros,
            updated_at_ms: config.last_updated_ms,
        });
    }

    // ---- swaps ----------------------------------------------------------------

    /// Swap SUI for freshly-minted TestUSD at the current oracle price.
    /// Always succeeds once a price has been set - TestUSD supply is
    /// unlimited by design.
    public fun swap_sui_to_testusd(
        config: &mut SwapConfig,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ): Coin<SWAP> {
        assert!(config.price_usd_micros > 0, EInvalidPrice);

        let sui_in = coin::value(&payment);
        let testusd_out = ((sui_in as u128) * (config.price_usd_micros as u128) / SUI_DECIMALS_FACTOR) as u64;

        let sui_balance = coin::into_balance(payment);
        balance::join(&mut config.sui_reserve, sui_balance);

        let minted = coin::mint(&mut config.treasury_cap, testusd_out, ctx);

        event::emit(SwappedSuiToTestUsd {
            user: ctx.sender(),
            sui_in,
            testusd_out,
            price_usd_micros: config.price_usd_micros,
        });

        minted
    }

    /// Swap TestUSD back for SUI at the current oracle price. Aborts with
    /// EInsufficientSuiLiquidity if the contract's accumulated SUI reserve
    /// (built from prior swap_sui_to_testusd calls) can't cover the payout -
    /// native SUI cannot be minted, so this is a genuine liquidity limit.
    public fun swap_testusd_to_sui(
        config: &mut SwapConfig,
        payment: Coin<SWAP>,
        ctx: &mut TxContext,
    ): Coin<SUI> {
        assert!(config.price_usd_micros > 0, EInvalidPrice);

        let testusd_in = coin::value(&payment);
        let sui_out = ((testusd_in as u128) * SUI_DECIMALS_FACTOR / (config.price_usd_micros as u128)) as u64;

        assert!(balance::value(&config.sui_reserve) >= sui_out, EInsufficientSuiLiquidity);

        coin::burn(&mut config.treasury_cap, payment);
        let payout_balance = balance::split(&mut config.sui_reserve, sui_out);
        let payout = coin::from_balance(payout_balance, ctx);

        event::emit(SwappedTestUsdToSui {
            user: ctx.sender(),
            testusd_in,
            sui_out,
            price_usd_micros: config.price_usd_micros,
        });

        payout
    }

    // ---- entry wrappers ----------------------------------------------------------

    /// Entry-friendly wrapper: swaps and transfers the result straight to the
    /// caller, so the frontend can call this directly in a PTB without a
    /// separate transfer step.
    public fun swap_sui_to_testusd_and_transfer(
        config: &mut SwapConfig,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        let out = swap_sui_to_testusd(config, payment, ctx);
        transfer::public_transfer(out, ctx.sender());
    }

    public fun swap_testusd_to_sui_and_transfer(
        config: &mut SwapConfig,
        payment: Coin<SWAP>,
        ctx: &mut TxContext,
    ) {
        let out = swap_testusd_to_sui(config, payment, ctx);
        transfer::public_transfer(out, ctx.sender());
    }

    // ---- read-only getters ----------------------------------------------------------

    public fun price_usd_micros(config: &SwapConfig): u64 { config.price_usd_micros }

    public fun sui_reserve_value(config: &SwapConfig): u64 { balance::value(&config.sui_reserve) }

    public fun last_updated_ms(config: &SwapConfig): u64 { config.last_updated_ms }

    // ---- test-only ----------------------------------------------------------------

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(SWAP {}, ctx);
    }
}
