#[test_only]
module swap_contract::swap_tests {
    use swap_contract::swap::{Self, SwapConfig, AdminCap, SWAP};
    use sui::clock;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::test_scenario as ts;

    const ADMIN: address = @0xAD;
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    /// $0.7598 per SUI, scaled by 10^6 - a real price observed live from
    /// DefiLlama earlier in this project's development.
    const PRICE: u64 = 759_800;
    const ONE_SUI: u64 = 1_000_000_000;

    // ---- helpers ----------------------------------------------------------------

    fun setup(): ts::Scenario {
        let mut scenario = ts::begin(ADMIN);
        swap::init_for_testing(scenario.ctx());
        scenario
    }

    fun set_price(scenario: &mut ts::Scenario, price: u64) {
        scenario.next_tx(ADMIN);
        let cap = scenario.take_from_sender<AdminCap>();
        let mut config = scenario.take_shared<SwapConfig>();
        let clk = clock::create_for_testing(scenario.ctx());

        swap::update_price(&mut config, price, &clk, &cap);

        clock::destroy_for_testing(clk);
        ts::return_shared(config);
        scenario.return_to_sender(cap);
    }

    // ---- tests ----------------------------------------------------------------

    #[test]
    fun swap_sui_to_testusd_mints_expected_amount() {
        let mut scenario = setup();
        set_price(&mut scenario, PRICE);

        scenario.next_tx(ALICE);
        let mut config = scenario.take_shared<SwapConfig>();
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, scenario.ctx());

        let out = swap::swap_sui_to_testusd(&mut config, payment, scenario.ctx());

        // 1 SUI at $0.759800/SUI -> 759_800 base units of a 6-decimal coin,
        // i.e. exactly 0.7598 TestUSD.
        assert!(coin::value(&out) == 759_800, 0);
        // The reserve grew by exactly what was paid in.
        assert!(swap::sui_reserve_value(&config) == ONE_SUI, 1);

        coin::burn_for_testing(out);
        ts::return_shared(config);
        scenario.end();
    }

    #[test]
    fun round_trip_returns_original_sui_amount() {
        let mut scenario = setup();
        set_price(&mut scenario, PRICE);

        scenario.next_tx(ALICE);
        let mut config = scenario.take_shared<SwapConfig>();
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, scenario.ctx());

        let testusd = swap::swap_sui_to_testusd(&mut config, payment, scenario.ctx());
        let sui_back = swap::swap_testusd_to_sui(&mut config, testusd, scenario.ctx());

        // Integer division on the way out and back round-trips exactly for
        // this price/amount pair - if this ever starts failing after a price
        // constant changes, check for compounding rounding loss instead of
        // assuming the contract is broken.
        assert!(coin::value(&sui_back) == ONE_SUI, 0);
        assert!(swap::sui_reserve_value(&config) == 0, 1);

        coin::burn_for_testing(sui_back);
        ts::return_shared(config);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = swap::EInsufficientSuiLiquidity)]
    fun testusd_to_sui_aborts_when_reserve_empty() {
        let mut scenario = setup();
        set_price(&mut scenario, PRICE);

        // BOB gets TestUSD from nowhere (test-only mint) without anyone ever
        // having deposited SUI - the reserve is still empty, so cashing out
        // must abort rather than pay from thin air.
        scenario.next_tx(BOB);
        let mut config = scenario.take_shared<SwapConfig>();
        let fake_testusd = coin::mint_for_testing<SWAP>(759_800, scenario.ctx());

        let sui_out = swap::swap_testusd_to_sui(&mut config, fake_testusd, scenario.ctx());

        coin::burn_for_testing(sui_out);
        ts::return_shared(config);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = swap::EInsufficientSuiLiquidity)]
    fun testusd_to_sui_aborts_when_reserve_partially_insufficient() {
        let mut scenario = setup();
        set_price(&mut scenario, PRICE);

        // Alice deposits 1 SUI worth of reserve...
        scenario.next_tx(ALICE);
        let mut config = scenario.take_shared<SwapConfig>();
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, scenario.ctx());
        let testusd = swap::swap_sui_to_testusd(&mut config, payment, scenario.ctx());
        coin::burn_for_testing(testusd);

        // ...but Bob tries to cash out 2 SUI worth of (test-minted) TestUSD -
        // more than the reserve actually holds.
        scenario.next_tx(BOB);
        let too_much_testusd = coin::mint_for_testing<SWAP>(759_800 * 2, scenario.ctx());
        let sui_out = swap::swap_testusd_to_sui(&mut config, too_much_testusd, scenario.ctx());

        coin::burn_for_testing(sui_out);
        ts::return_shared(config);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = swap::EInvalidPrice)]
    fun swap_before_any_price_set_aborts() {
        let mut scenario = setup();

        // No update_price call at all - price_usd_micros is still its
        // initial 0.
        scenario.next_tx(ALICE);
        let mut config = scenario.take_shared<SwapConfig>();
        let payment = coin::mint_for_testing<SUI>(ONE_SUI, scenario.ctx());

        let out = swap::swap_sui_to_testusd(&mut config, payment, scenario.ctx());

        coin::burn_for_testing(out);
        ts::return_shared(config);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = swap::EInvalidPrice)]
    fun update_price_rejects_zero() {
        let mut scenario = setup();
        set_price(&mut scenario, 0);
        scenario.end();
    }

    #[test]
    fun update_price_is_readable_after_being_set() {
        let mut scenario = setup();
        set_price(&mut scenario, PRICE);

        scenario.next_tx(ALICE);
        let config = scenario.take_shared<SwapConfig>();
        assert!(swap::price_usd_micros(&config) == PRICE, 0);
        assert!(swap::last_updated_ms(&config) == 0, 1); // test clock starts at 0

        ts::return_shared(config);
        scenario.end();
    }
}
