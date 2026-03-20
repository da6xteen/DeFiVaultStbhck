use anchor_lang::prelude::*;

declare_id!("Be9ogGkqJ7u4b4ZzjAa2sv3t8gesPt8nNhhBKaCbSzjB");

#[program]
pub mod compliance_oracle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
