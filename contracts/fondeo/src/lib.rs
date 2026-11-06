#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env};

// Un ledger dura unos 5 segundos: 17 280 ledgers son un día.
const DIA_EN_LEDGERS: u32 = 17_280;
const UMBRAL_TTL: u32 = 30 * DIA_EN_LEDGERS;
const EXTENDER_TTL: u32 = 60 * DIA_EN_LEDGERS;

/// Un activo de Stellar tiene 7 decimales: 1 fracción = 1,0000000 del activo.
const UNIDAD: i128 = 10_000_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// El contrato ya estaba configurado.
    AlreadyInitialized = 1,
    /// El contrato todavía no está configurado.
    NoInicializado = 2,
    /// El precio, el total de fracciones y la duración deben ser mayores que cero.
    ParametroInvalido = 3,
    /// Debes indicar al menos una fracción.
    FraccionesInvalidas = 4,
    /// No quedan tantas fracciones disponibles.
    NoHayFracciones = 5,
    /// La ronda ya no recibe inversiones.
    RondaCerrada = 6,
    /// La ronda todavía no alcanza su meta.
    RondaNoExitosa = 7,
    /// Los fondos ya fueron liberados.
    YaLiberada = 8,
    /// La ronda no ha fallado: no hay reembolso.
    RondaNoFallida = 9,
    /// No tienes tantas fracciones.
    SaldoInsuficiente = 10,
}

#[contracttype]
#[derive(Clone)]
pub enum Clave {
    Config,
    Estado,
    Vendidas,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    /// Quien autoriza la liberación de los fondos (en la vida real, una fiduciaria).
    pub fiduciaria: Address,
    /// Quien recibe el dinero si la ronda es exitosa.
    pub constructora: Address,
    /// Activo con el que se paga (XLM).
    pub token_pago: Address,
    /// Activo de Stellar de las fracciones. Este contrato debe ser su administrador.
    pub token_participacion: Address,
    /// Precio de cada fracción, en la unidad mínima del token de pago.
    pub precio_fraccion: i128,
    pub total_fracciones: u32,
    /// Momento (segundos) en que se acaba el plazo de la ronda.
    pub fecha_limite: u64,
}

/// Lo que se guarda: la ronda está recaudando, ya se completó o ya se liberó.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Estado {
    Recaudando,
    Exitosa,
    Liberada,
}

/// Lo que se muestra: además de lo guardado, una ronda puede estar fallida.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EstadoRonda {
    Recaudando,
    Exitosa,
    Liberada,
    Fallida,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Resumen {
    pub estado: EstadoRonda,
    pub vendidas: u32,
    pub total: u32,
    pub precio_fraccion: i128,
    pub fecha_limite: u64,
    pub recaudado: i128,
}

#[contract]
pub struct FondeoContract;

#[contractimpl]
impl FondeoContract {
    /// Configura el contrato una sola vez. Firma la fiduciaria.
    #[allow(clippy::too_many_arguments)]
    pub fn init(
        env: Env,
        fiduciaria: Address,
        constructora: Address,
        token_pago: Address,
        token_participacion: Address,
        precio_fraccion: i128,
        total_fracciones: u32,
        duracion: u64,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&Clave::Config) {
            return Err(Error::AlreadyInitialized);
        }
        if precio_fraccion <= 0 || total_fracciones == 0 || duracion == 0 {
            return Err(Error::ParametroInvalido);
        }
        precio_fraccion
            .checked_mul(i128::from(total_fracciones))
            .ok_or(Error::ParametroInvalido)?;
        fiduciaria.require_auth();
        let config = Config {
            fiduciaria,
            constructora,
            token_pago,
            token_participacion,
            precio_fraccion,
            total_fracciones,
            fecha_limite: env.ledger().timestamp() + duracion,
        };
        env.storage().instance().set(&Clave::Config, &config);
        env.storage()
            .instance()
            .set(&Clave::Estado, &Estado::Recaudando);
        env.storage().instance().set(&Clave::Vendidas, &0u32);
        Self::extender_instancia(&env);
        Ok(())
    }

    /// Cualquiera compra fracciones: su dinero queda bloqueado en el contrato y
    /// recibe a cambio el activo de Stellar de las fracciones.
    pub fn invertir(env: Env, inversionista: Address, fracciones: u32) -> Result<u32, Error> {
        inversionista.require_auth();
        let config = Self::leer_config(&env)?;
        if fracciones == 0 {
            return Err(Error::FraccionesInvalidas);
        }
        if Self::estado_ronda(&env, &config) != EstadoRonda::Recaudando {
            return Err(Error::RondaCerrada);
        }
        let vendidas = Self::leer_vendidas(&env);
        if fracciones > config.total_fracciones - vendidas {
            return Err(Error::NoHayFracciones);
        }
        let monto = i128::from(fracciones)
            .checked_mul(config.precio_fraccion)
            .ok_or(Error::ParametroInvalido)?;
        let nuevas = vendidas + fracciones;

        // Primero se guarda el estado y después se mueve el dinero y se emiten los tokens.
        env.storage().instance().set(&Clave::Vendidas, &nuevas);
        if nuevas == config.total_fracciones {
            env.storage()
                .instance()
                .set(&Clave::Estado, &Estado::Exitosa);
        }
        Self::extender_instancia(&env);

        token::TokenClient::new(&env, &config.token_pago).transfer(
            &inversionista,
            env.current_contract_address(),
            &monto,
        );
        token::StellarAssetClient::new(&env, &config.token_participacion)
            .mint(&inversionista, &(i128::from(fracciones) * UNIDAD));
        Ok(nuevas)
    }

    /// La fiduciaria libera el dinero a la constructora cuando la ronda fue exitosa.
    pub fn liberar(env: Env) -> Result<(), Error> {
        let config = Self::leer_config(&env)?;
        config.fiduciaria.require_auth();
        match Self::leer_estado(&env) {
            Estado::Recaudando => return Err(Error::RondaNoExitosa),
            Estado::Liberada => return Err(Error::YaLiberada),
            Estado::Exitosa => {}
        }
        let monto = i128::from(Self::leer_vendidas(&env)) * config.precio_fraccion;
        env.storage()
            .instance()
            .set(&Clave::Estado, &Estado::Liberada);
        token::TokenClient::new(&env, &config.token_pago).transfer(
            &env.current_contract_address(),
            &config.constructora,
            &monto,
        );
        Ok(())
    }

    /// Si la ronda falló, quien tenga fracciones las devuelve (se destruyen) y
    /// recupera su dinero. Sirve también para quien las recibió de otra persona.
    pub fn reembolsar(env: Env, tenedor: Address, fracciones: u32) -> Result<(), Error> {
        tenedor.require_auth();
        let config = Self::leer_config(&env)?;
        if fracciones == 0 {
            return Err(Error::FraccionesInvalidas);
        }
        if Self::estado_ronda(&env, &config) != EstadoRonda::Fallida {
            return Err(Error::RondaNoFallida);
        }
        let tokens = i128::from(fracciones) * UNIDAD;
        let activo = token::TokenClient::new(&env, &config.token_participacion);
        if activo.balance(&tenedor) < tokens {
            return Err(Error::SaldoInsuficiente);
        }
        let vendidas = Self::leer_vendidas(&env);
        env.storage()
            .instance()
            .set(&Clave::Vendidas, &vendidas.saturating_sub(fracciones));

        activo.burn(&tenedor, &tokens);
        token::TokenClient::new(&env, &config.token_pago).transfer(
            &env.current_contract_address(),
            &tenedor,
            &(i128::from(fracciones) * config.precio_fraccion),
        );
        Ok(())
    }

    /// Lectura: el estado de la ronda.
    pub fn resumen(env: Env) -> Result<Resumen, Error> {
        let config = Self::leer_config(&env)?;
        let vendidas = Self::leer_vendidas(&env);
        Ok(Resumen {
            estado: Self::estado_ronda(&env, &config),
            vendidas,
            total: config.total_fracciones,
            precio_fraccion: config.precio_fraccion,
            fecha_limite: config.fecha_limite,
            recaudado: i128::from(vendidas) * config.precio_fraccion,
        })
    }

    /// Lectura: la configuración del contrato.
    pub fn config(env: Env) -> Result<Config, Error> {
        Self::leer_config(&env)
    }
}

impl FondeoContract {
    fn leer_config(env: &Env) -> Result<Config, Error> {
        env.storage()
            .instance()
            .get(&Clave::Config)
            .ok_or(Error::NoInicializado)
    }

    fn leer_estado(env: &Env) -> Estado {
        env.storage()
            .instance()
            .get(&Clave::Estado)
            .unwrap_or(Estado::Recaudando)
    }

    fn leer_vendidas(env: &Env) -> u32 {
        env.storage().instance().get(&Clave::Vendidas).unwrap_or(0)
    }

    /// La ronda fallida no se guarda: es la que sigue recaudando cuando ya pasó el plazo.
    fn estado_ronda(env: &Env, config: &Config) -> EstadoRonda {
        match Self::leer_estado(env) {
            Estado::Liberada => EstadoRonda::Liberada,
            Estado::Exitosa => EstadoRonda::Exitosa,
            Estado::Recaudando => {
                if env.ledger().timestamp() >= config.fecha_limite {
                    EstadoRonda::Fallida
                } else {
                    EstadoRonda::Recaudando
                }
            }
        }
    }

    fn extender_instancia(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(UMBRAL_TTL, EXTENDER_TTL);
    }
}

mod test;
