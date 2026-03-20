use anchor_lang::prelude::*;

declare_id!("8z9D4kVpSKL5WjQCo92oU4vvZeBPwb7VMe1Et9T3qKHa");

#[program]
pub mod kyc_registry {
    use super::*;

    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let registry_config = &mut ctx.accounts.registry_config;
        registry_config.authority = ctx.accounts.authority.key();
        registry_config.paused = false;
        Ok(())
    }

    pub fn register_user(
        ctx: Context<RegisterUser>,
        kyc_hash: [u8; 32],
        risk_score: u16,
        pep_flag: bool,
        sanctions_flag: bool,
        expires_at: i64,
    ) -> Result<()> {
        if risk_score > 1000 {
            return Err(KycError::InvalidRiskScore.into());
        }

        let clock = Clock::get()?;
        if expires_at <= clock.unix_timestamp {
            return Err(KycError::InvalidExpiry.into());
        }

        let kyc_record = &mut ctx.accounts.kyc_record;
        kyc_record.wallet = ctx.accounts.wallet_address.key();
        kyc_record.kyc_hash = kyc_hash;
        kyc_record.risk_score = risk_score;
        kyc_record.pep_flag = pep_flag;
        kyc_record.sanctions_flag = sanctions_flag;
        kyc_record.expires_at = expires_at;
        kyc_record.approved_at = clock.unix_timestamp;
        kyc_record.bump = ctx.bumps.kyc_record;

        let status = if !pep_flag && !sanctions_flag && risk_score < 700 {
            KycStatus::Approved
        } else {
            KycStatus::Rejected
        };

        kyc_record.status = status.clone();

        emit!(KycRegistered {
            wallet: kyc_record.wallet,
            status,
            risk_score,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn revoke_kyc(ctx: Context<RevokeKyc>) -> Result<()> {
        let kyc_record = &mut ctx.accounts.kyc_record;
        kyc_record.status = KycStatus::Rejected;

        let clock = Clock::get()?;
        emit!(KycRevoked {
            wallet: kyc_record.wallet,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1,
        seeds = [b"registry_config"],
        bump
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterUser<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 1 + 2 + 8 + 8 + 1 + 1 + 1,
        seeds = [b"kyc", wallet_address.key().as_ref()],
        bump
    )]
    pub kyc_record: Account<'info, KycRecord>,
    /// CHECK: This is the wallet address being registered
    pub wallet_address: AccountInfo<'info>,
    #[account(
        seeds = [b"registry_config"],
        bump,
        constraint = registry_config.authority == authority.key() @ KycError::Unauthorized,
        constraint = !registry_config.paused @ KycError::RegistryPaused
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeKyc<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"kyc", kyc_record.wallet.as_ref()],
        bump = kyc_record.bump,
    )]
    pub kyc_record: Account<'info, KycRecord>,
    #[account(
        seeds = [b"registry_config"],
        bump,
        constraint = registry_config.authority == authority.key() @ KycError::Unauthorized
    )]
    pub registry_config: Account<'info, RegistryConfig>,
}

#[account]
pub struct RegistryConfig {
    pub authority: Pubkey,
    pub paused: bool,
}

#[account]
pub struct KycRecord {
    pub wallet: Pubkey,          // 32 bytes
    pub kyc_hash: [u8; 32],     // SHA-256 of KYC data — 32 bytes
    pub status: KycStatus,       // 1 byte
    pub risk_score: u16,         // 0-1000 representing 0.000-1.000 — 2 bytes
    pub approved_at: i64,        // Unix timestamp — 8 bytes
    pub expires_at: i64,         // Unix timestamp — 8 bytes
    pub pep_flag: bool,          // 1 byte
    pub sanctions_flag: bool,    // 1 byte
    pub bump: u8,                // 1 byte
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum KycStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
}

#[event]
pub struct KycRegistered {
    pub wallet: Pubkey,
    pub status: KycStatus,
    pub risk_score: u16,
    pub timestamp: i64,
}

#[event]
pub struct KycRevoked {
    pub wallet: Pubkey,
    pub timestamp: i64,
}

#[error_code]
pub enum KycError {
    #[msg("Unauthorized: only registry authority can perform this action")]
    Unauthorized,
    #[msg("KYC record already exists for this wallet")]
    AlreadyRegistered,
    #[msg("Registry is paused")]
    RegistryPaused,
    #[msg("Risk score exceeds maximum allowed value 1000")]
    InvalidRiskScore,
    #[msg("Expiry timestamp must be in the future")]
    InvalidExpiry,
}
