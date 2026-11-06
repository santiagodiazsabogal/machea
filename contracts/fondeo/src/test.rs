#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal,
};

const PRECIO: i128 = 1_000;
const TOTAL: u32 = 10;
const DURACION: u64 = 7 * 24 * 60 * 60;

struct Escenario<'a> {
    env: Env,
    cliente: FondeoContractClient<'a>,
    pago: TokenClient<'a>,
    fracciones: TokenClient<'a>,
    constructora: Address,
}

fn preparar<'a>() -> Escenario<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin_pago = Address::generate(&env);
    let pago_id = env.register_stellar_asset_contract_v2(admin_pago).address();

    // El activo de las fracciones lo emite una cuenta emisora, que luego le
    // entrega al contrato la administración del activo.
    let emisor = Address::generate(&env);
    let fracciones_id = env.register_stellar_asset_contract_v2(emisor).address();
    let contrato = env.register(FondeoContract, ());
    StellarAssetClient::new(&env, &fracciones_id).set_admin(&contrato);

    let fiduciaria = Address::generate(&env);
    let constructora = Address::generate(&env);
    let cliente = FondeoContractClient::new(&env, &contrato);
    cliente.init(
        &fiduciaria,
        &constructora,
        &pago_id,
        &fracciones_id,
        &PRECIO,
        &TOTAL,
        &DURACION,
    );

    Escenario {
        pago: TokenClient::new(&env, &pago_id),
        fracciones: TokenClient::new(&env, &fracciones_id),
        env,
        cliente,
        constructora,
    }
}

/// Una wallet nueva con saldo para pagar.
fn inversionista(e: &Escenario, saldo: i128) -> Address {
    let a = Address::generate(&e.env);
    StellarAssetClient::new(&e.env, &e.pago.address).mint(&a, &saldo);
    a
}

/// Alguien compra todas las fracciones y cierra la ronda.
fn llenar(e: &Escenario) -> Address {
    let w = inversionista(e, i128::from(TOTAL) * PRECIO);
    e.cliente.invertir(&w, &TOTAL);
    w
}

fn pasar_el_plazo(e: &Escenario) {
    e.env
        .ledger()
        .set_timestamp(e.env.ledger().timestamp() + DURACION);
}

#[test]
fn init_solo_una_vez() {
    let e = preparar();
    let otro = Address::generate(&e.env);
    let res = e
        .cliente
        .try_init(&otro, &otro, &otro, &otro, &PRECIO, &TOTAL, &DURACION);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn init_con_valores_en_cero_falla() {
    let env = Env::default();
    env.mock_all_auths();
    let a = Address::generate(&env);
    let contrato = env.register(FondeoContract, ());
    let cliente = FondeoContractClient::new(&env, &contrato);
    let invalido = Err(Ok(Error::ParametroInvalido));
    assert_eq!(
        cliente.try_init(&a, &a, &a, &a, &0, &TOTAL, &DURACION),
        invalido
    );
    assert_eq!(
        cliente.try_init(&a, &a, &a, &a, &PRECIO, &0, &DURACION),
        invalido
    );
    assert_eq!(
        cliente.try_init(&a, &a, &a, &a, &PRECIO, &TOTAL, &0),
        invalido
    );
}

#[test]
fn invertir_bloquea_fondos_y_entrega_tokens() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    let vendidas = e.cliente.invertir(&ana, &3);
    assert_eq!(vendidas, 3);
    assert_eq!(e.pago.balance(&ana), 10_000 - 3 * PRECIO);
    assert_eq!(e.pago.balance(&e.cliente.address), 3 * PRECIO);
    assert_eq!(e.fracciones.balance(&ana), 3 * UNIDAD);
    let r = e.cliente.resumen();
    assert_eq!(r.estado, EstadoRonda::Recaudando);
    assert_eq!(r.vendidas, 3);
    assert_eq!(r.recaudado, 3 * PRECIO);
}

#[test]
fn invertir_cero_falla() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    assert_eq!(
        e.cliente.try_invertir(&ana, &0),
        Err(Ok(Error::FraccionesInvalidas))
    );
}

#[test]
fn invertir_mas_de_las_disponibles_falla() {
    let e = preparar();
    let ana = inversionista(&e, 100_000);
    assert_eq!(
        e.cliente.try_invertir(&ana, &(TOTAL + 1)),
        Err(Ok(Error::NoHayFracciones))
    );
}

#[test]
#[should_panic]
fn invertir_sin_firma_falla() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    e.env.mock_auths(&[]);
    e.cliente.invertir(&ana, &1);
}

#[test]
fn invertir_despues_del_plazo_falla() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    pasar_el_plazo(&e);
    assert_eq!(
        e.cliente.try_invertir(&ana, &1),
        Err(Ok(Error::RondaCerrada))
    );
}

#[test]
fn la_ultima_fraccion_cierra_la_ronda() {
    let e = preparar();
    llenar(&e);
    let r = e.cliente.resumen();
    assert_eq!(r.estado, EstadoRonda::Exitosa);
    assert_eq!(r.vendidas, TOTAL);
}

#[test]
fn invertir_con_la_ronda_exitosa_falla() {
    let e = preparar();
    llenar(&e);
    let otro = inversionista(&e, 10_000);
    assert_eq!(
        e.cliente.try_invertir(&otro, &1),
        Err(Ok(Error::RondaCerrada))
    );
}

#[test]
fn cualquiera_puede_invertir() {
    let e = preparar();
    let uno = inversionista(&e, 5_000);
    let dos = inversionista(&e, 5_000);
    e.cliente.invertir(&uno, &1);
    e.cliente.invertir(&dos, &2);
    assert_eq!(e.fracciones.balance(&uno), UNIDAD);
    assert_eq!(e.fracciones.balance(&dos), 2 * UNIDAD);
}

#[test]
fn liberar_envia_a_la_constructora() {
    let e = preparar();
    llenar(&e);
    e.cliente.liberar();
    assert_eq!(e.pago.balance(&e.constructora), i128::from(TOTAL) * PRECIO);
    assert_eq!(e.pago.balance(&e.cliente.address), 0);
    assert_eq!(e.cliente.resumen().estado, EstadoRonda::Liberada);
}

#[test]
#[should_panic]
fn liberar_sin_firma_de_la_fiduciaria_falla() {
    let e = preparar();
    llenar(&e);
    e.env.mock_auths(&[]);
    e.cliente.liberar();
}

#[test]
fn liberar_antes_de_la_meta_falla() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    e.cliente.invertir(&ana, &1);
    assert_eq!(e.cliente.try_liberar(), Err(Ok(Error::RondaNoExitosa)));
}

#[test]
fn liberar_dos_veces_falla() {
    let e = preparar();
    llenar(&e);
    e.cliente.liberar();
    assert_eq!(e.cliente.try_liberar(), Err(Ok(Error::YaLiberada)));
}

#[test]
fn reembolsar_tras_fallar_destruye_tokens_y_devuelve_dinero() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    e.cliente.invertir(&ana, &4);
    pasar_el_plazo(&e);
    assert_eq!(e.cliente.resumen().estado, EstadoRonda::Fallida);
    e.cliente.reembolsar(&ana, &4);
    assert_eq!(e.pago.balance(&ana), 10_000);
    assert_eq!(e.fracciones.balance(&ana), 0);
    assert_eq!(e.pago.balance(&e.cliente.address), 0);
    assert_eq!(e.cliente.resumen().vendidas, 0);
}

#[test]
fn reembolsar_antes_del_plazo_falla() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    e.cliente.invertir(&ana, &1);
    assert_eq!(
        e.cliente.try_reembolsar(&ana, &1),
        Err(Ok(Error::RondaNoFallida))
    );
}

#[test]
fn reembolsar_con_la_ronda_exitosa_falla() {
    let e = preparar();
    let w = llenar(&e);
    pasar_el_plazo(&e);
    assert_eq!(
        e.cliente.try_reembolsar(&w, &1),
        Err(Ok(Error::RondaNoFallida))
    );
}

#[test]
fn reembolsar_mas_tokens_de_los_que_tiene_falla() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    e.cliente.invertir(&ana, &2);
    pasar_el_plazo(&e);
    assert_eq!(
        e.cliente.try_reembolsar(&ana, &3),
        Err(Ok(Error::SaldoInsuficiente))
    );
}

#[test]
fn reembolsa_quien_recibio_los_tokens_por_transferencia() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    let luis = Address::generate(&e.env);
    e.cliente.invertir(&ana, &2);
    e.fracciones.transfer(&ana, &luis, &(2 * UNIDAD));
    pasar_el_plazo(&e);
    e.cliente.reembolsar(&luis, &2);
    assert_eq!(e.pago.balance(&luis), 2 * PRECIO);
    assert_eq!(e.fracciones.balance(&luis), 0);
    assert_eq!(e.pago.balance(&ana), 10_000 - 2 * PRECIO);
}

#[test]
fn los_tokens_se_pueden_transferir() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    let luis = Address::generate(&e.env);
    e.cliente.invertir(&ana, &2);
    e.fracciones.transfer(&ana, &luis, &UNIDAD);
    assert_eq!(e.fracciones.balance(&ana), UNIDAD);
    assert_eq!(e.fracciones.balance(&luis), UNIDAD);
}

// Las dos pruebas siguientes no dan por autorizado todo: solo firma quien
// debe firmar. La emisión y la destrucción de tokens por parte del contrato
// tienen que funcionar sin ninguna firma extra.

#[test]
fn invertir_funciona_solo_con_la_firma_del_inversionista() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    let fracciones: u32 = 2;
    let monto = i128::from(fracciones) * PRECIO;
    e.env.mock_auths(&[MockAuth {
        address: &ana,
        invoke: &MockAuthInvoke {
            contract: &e.cliente.address,
            fn_name: "invertir",
            args: (ana.clone(), fracciones).into_val(&e.env),
            sub_invokes: &[MockAuthInvoke {
                contract: &e.pago.address,
                fn_name: "transfer",
                args: (ana.clone(), e.cliente.address.clone(), monto).into_val(&e.env),
                sub_invokes: &[],
            }],
        },
    }]);
    e.cliente.invertir(&ana, &fracciones);
    assert_eq!(e.fracciones.balance(&ana), i128::from(fracciones) * UNIDAD);
}

#[test]
fn reembolsar_funciona_solo_con_la_firma_del_tenedor() {
    let e = preparar();
    let ana = inversionista(&e, 10_000);
    let fracciones: u32 = 2;
    e.cliente.invertir(&ana, &fracciones);
    pasar_el_plazo(&e);
    let tokens = i128::from(fracciones) * UNIDAD;
    e.env.mock_auths(&[MockAuth {
        address: &ana,
        invoke: &MockAuthInvoke {
            contract: &e.cliente.address,
            fn_name: "reembolsar",
            args: (ana.clone(), fracciones).into_val(&e.env),
            sub_invokes: &[MockAuthInvoke {
                contract: &e.fracciones.address,
                fn_name: "burn",
                args: (ana.clone(), tokens).into_val(&e.env),
                sub_invokes: &[],
            }],
        },
    }]);
    e.cliente.reembolsar(&ana, &fracciones);
    assert_eq!(e.fracciones.balance(&ana), 0);
    assert_eq!(e.pago.balance(&ana), 10_000);
}
