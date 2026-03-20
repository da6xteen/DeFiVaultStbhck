use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("BXRCHDecnkhFgcweBhjVUtQMPhYTEmGvuyVB8UzvZuyN");

#[program]
#[allow(unexpected_cfgs)]
pub mod vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        deposit_limit_per_user: u64,
        travel_rule_threshold: u64,
        kyc_registry_program: Pubkey,
    ) -> Result<()> {
        let vault_config = &mut ctx.accounts.vault_config;
        vault_config.authority = ctx.accounts.authority.key();
        vault_config.kyc_registry_program = kyc_registry_program;
        vault_config.usdc_mint = ctx.accounts.usdc_mint.key();
        vault_config.vault_token_account = ctx.accounts.vault_token_account.key();
        vault_config.total_deposited = 0;
        vault_config.total_withdrawn = 0;
        vault_config.deposit_limit_per_user = deposit_limit_per_user;
        vault_config.travel_rule_threshold = travel_rule_threshold;
        vault_config.paused = false;
        vault_config.bump = ctx.bumps.vault_config;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let clock = Clock::get()?;

        // 1. vault_config.paused == false
        require!(!ctx.accounts.vault_config.paused, VaultError::VaultPaused);

        // 2. Read kyc_record account data
        let kyc_record_info = &ctx.accounts.kyc_record;

        // --- SECURITY: Verify kyc_record PDA and owner ---
        let (expected_kyc_pda, _bump) = Pubkey::find_program_address(
            &[b"kyc", ctx.accounts.user.key().as_ref()],
            &ctx.accounts.vault_config.kyc_registry_program
        );
        require_keys_eq!(kyc_record_info.key(), expected_kyc_pda, VaultError::Unauthorized);
        require_keys_eq!(*kyc_record_info.owner, ctx.accounts.vault_config.kyc_registry_program, VaultError::Unauthorized);

        // Manual deserialization of KycRecord
        let mut data: &[u8] = &kyc_record_info.try_borrow_data()?;
        let kyc_record = KycRecord::try_deserialize(&mut data)?;

        require_keys_eq!(kyc_record.wallet, ctx.accounts.user.key(), VaultError::Unauthorized);
        require!(kyc_record.status == KycStatus::Approved, VaultError::KycNotApproved);

        // 3. Check kyc_record.expires_at > Clock::get().unix_timestamp
        require!(kyc_record.expires_at > clock.unix_timestamp, VaultError::KycExpired);

        // 4. Check user_vault_account.deposited_amount + amount <= vault_config.deposit_limit_per_user
        require!(
            ctx.accounts.user_vault_account.deposited_amount.checked_add(amount).ok_or(VaultError::InvalidAmount)? <= ctx.accounts.vault_config.deposit_limit_per_user,
            VaultError::DepositLimitExceeded
        );

        // 5. amount > 0
        require!(amount > 0, VaultError::InvalidAmount);

        // Execute: token::transfer
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update UserVaultAccount
        let user_vault_account = &mut ctx.accounts.user_vault_account;
        user_vault_account.owner = ctx.accounts.user.key();
        user_vault_account.deposited_amount = user_vault_account.deposited_amount.checked_add(amount).ok_or(VaultError::InvalidAmount)?;
        user_vault_account.last_deposit_ts = clock.unix_timestamp;
        user_vault_account.bump = ctx.bumps.user_vault_account;

        // Update VaultConfig totals
        let travel_rule_threshold = ctx.accounts.vault_config.travel_rule_threshold;
        let vault_config_mut = &mut ctx.accounts.vault_config;
        vault_config_mut.total_deposited = vault_config_mut.total_deposited.checked_add(amount).ok_or(VaultError::InvalidAmount)?;

        // Emit DepositEvent
        emit!(DepositEvent {
            user: ctx.accounts.user.key(),
            amount,
            total_deposited: vault_config_mut.total_deposited,
            travel_rule_required: amount >= travel_rule_threshold,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let clock = Clock::get()?;

        // 1. vault_config.paused == false
        require!(!ctx.accounts.vault_config.paused, VaultError::VaultPaused);

        // 2. KYC approved and not expired
        let kyc_record_info = &ctx.accounts.kyc_record;

        // --- SECURITY: Verify kyc_record PDA and owner ---
        let (expected_kyc_pda, _bump) = Pubkey::find_program_address(
            &[b"kyc", ctx.accounts.user.key().as_ref()],
            &ctx.accounts.vault_config.kyc_registry_program
        );
        require_keys_eq!(kyc_record_info.key(), expected_kyc_pda, VaultError::Unauthorized);
        require_keys_eq!(*kyc_record_info.owner, ctx.accounts.vault_config.kyc_registry_program, VaultError::Unauthorized);

        let mut data: &[u8] = &kyc_record_info.try_borrow_data()?;
        let kyc_record = KycRecord::try_deserialize(&mut data)?;

        require_keys_eq!(kyc_record.wallet, ctx.accounts.user.key(), VaultError::Unauthorized);
        require!(kyc_record.status == KycStatus::Approved, VaultError::KycNotApproved);
        require!(kyc_record.expires_at > clock.unix_timestamp, VaultError::KycExpired);

        // 3. user_vault_account.deposited_amount - user_vault_account.withdrawn_amount >= amount
        let current_balance = ctx.accounts.user_vault_account.deposited_amount.checked_sub(ctx.accounts.user_vault_account.withdrawn_amount).ok_or(VaultError::InsufficientBalance)?;
        require!(current_balance >= amount, VaultError::InsufficientBalance);

        // 4. amount > 0
        require!(amount > 0, VaultError::InvalidAmount);

        // Execute: token::transfer with PDA signer
        let vault_config_bump = ctx.accounts.vault_config.bump;
        let seeds = &[
            b"vault_config".as_ref(),
            &[vault_config_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        // Update balances
        let user_vault_account = &mut ctx.accounts.user_vault_account;
        user_vault_account.withdrawn_amount = user_vault_account.withdrawn_amount.checked_add(amount).ok_or(VaultError::InvalidAmount)?;
        user_vault_account.last_withdrawal_ts = clock.unix_timestamp;

        let travel_rule_threshold = ctx.accounts.vault_config.travel_rule_threshold;
        let vault_config_mut = &mut ctx.accounts.vault_config;
        vault_config_mut.total_withdrawn = vault_config_mut.total_withdrawn.checked_add(amount).ok_or(VaultError::InvalidAmount)?;

        // Emit WithdrawEvent
        emit!(WithdrawEvent {
            user: ctx.accounts.user.key(),
            amount,
            travel_rule_required: amount >= travel_rule_threshold,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn pause_vault(ctx: Context<PauseVault>) -> Result<()> {
        let vault_config = &mut ctx.accounts.vault_config;
        vault_config.paused = true;
        Ok(())
    }

    pub fn unpause_vault(ctx: Context<UnpauseVault>) -> Result<()> {
        let vault_config = &mut ctx.accounts.vault_config;
        vault_config.paused = false;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(deposit_limit_per_user: u64, travel_rule_threshold: u64, kyc_registry_program: Pubkey)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 170,
        seeds = [b"vault_config"],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_config,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 73,
        seeds = [b"user_vault", user.key().as_ref()],
        bump
    )]
    pub user_vault_account: Account<'info, UserVaultAccount>,

    #[account(
        mut,
        constraint = user_token_account.mint == vault_config.usdc_mint @ VaultError::InvalidAmount
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault_config.vault_token_account @ VaultError::Unauthorized
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: Verified in instruction logic: PDA check and owner check
    pub kyc_record: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user_vault", user.key().as_ref()],
        bump = user_vault_account.bump,
        constraint = user_vault_account.owner == user.key() @ VaultError::Unauthorized
    )]
    pub user_vault_account: Account<'info, UserVaultAccount>,

    #[account(
        mut,
        constraint = user_token_account.mint == vault_config.usdc_mint @ VaultError::InvalidAmount
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.key() == vault_config.vault_token_account @ VaultError::Unauthorized
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// CHECK: Verified in instruction logic: PDA check and owner check
    pub kyc_record: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PauseVault<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        constraint = vault_config.authority == authority.key() @ VaultError::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct UnpauseVault<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        constraint = vault_config.authority == authority.key() @ VaultError::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[account]
pub struct VaultConfig {
    pub authority: Pubkey,           // 32
    pub kyc_registry_program: Pubkey, // 32
    pub usdc_mint: Pubkey,           // 32
    pub vault_token_account: Pubkey, // 32
    pub total_deposited: u64,        // 8
    pub total_withdrawn: u64,        // 8
    pub deposit_limit_per_user: u64, // 8
    pub travel_rule_threshold: u64,  // 8
    pub paused: bool,                // 1
    pub bump: u8,                    // 1
}
// Space: 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 = 170 bytes

#[account]
pub struct UserVaultAccount {
    pub owner: Pubkey,               // 32
    pub deposited_amount: u64,       // 8
    pub withdrawn_amount: u64,       // 8
    pub last_deposit_ts: i64,        // 8
    pub last_withdrawal_ts: i64,     // 8
    pub bump: u8,                    // 1
}
// Space: 8 + 32 + 8 + 8 + 8 + 8 + 1 = 73 bytes

#[account]
#[derive(Default)]
pub struct KycRecord {
    pub wallet: Pubkey,
    pub kyc_hash: [u8; 32],
    pub status: KycStatus,
    pub risk_score: u16,
    pub approved_at: i64,
    pub expires_at: i64,
    pub pep_flag: bool,
    pub sanctions_flag: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum KycStatus {
    #[default]
    Pending,
    Approved,
    Rejected,
    Expired,
}

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub total_deposited: u64,
    pub travel_rule_required: bool,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub travel_rule_required: bool,
    pub timestamp: i64,
}

#[error_code]
pub enum VaultError {
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("KYC verification required")]
    KycNotApproved,
    #[msg("KYC has expired")]
    KycExpired,
    #[msg("Deposit would exceed per-user limit")]
    DepositLimitExceeded,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient vault balance")]
    InsufficientBalance,
    #[msg("Unauthorized")]
    Unauthorized,
}
