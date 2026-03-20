import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// @ts-ignore
import { Vault } from "../target/types/vault";
// @ts-ignore
import { KycRegistry } from "../target/types/kyc_registry";
import { expect } from "chai";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import * as crypto from "crypto";

describe("vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // @ts-ignore
  const vaultProgram = anchor.workspace.Vault as Program<Vault>;
  // @ts-ignore
  const kycProgram = anchor.workspace.KycRegistry as Program<KycRegistry>;
  const authority = (provider.wallet as anchor.Wallet).payer;

  let usdcMint: PublicKey;
  let vaultConfigPda: PublicKey;
  let vaultTokenAccount: PublicKey;

  const depositLimit = new anchor.BN(10_000_000); // 10 USDC
  const travelRuleThreshold = new anchor.BN(1_000_000); // 1 USDC

  before(async () => {
    // Create mock USDC mint
    usdcMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    [vaultConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_config")],
      vaultProgram.programId
    );

    vaultTokenAccount = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: vaultConfigPda
    });
  });

  async function createKycRecord(user: PublicKey, status: "approved" | "rejected" | "expired") {
    const [kycRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), user.toBuffer()],
      kycProgram.programId
    );

    const kycHash = Array.from(crypto.createHash("sha256").update(user.toBase58()).digest());
    const riskScore = status === "rejected" ? 800 : 100;

    let expiresAt: anchor.BN;
    if (status === "expired") {
        expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) - 3600);
    } else {
        expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);
    }

    // Initialize Registry if not already
    try {
        const [registryConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("registry_config")],
            kycProgram.programId
        );
        await kycProgram.methods.initializeRegistry().accounts({
            authority: authority.publicKey,
            registryConfig: registryConfigPda,
            systemProgram: SystemProgram.programId,
        } as any).rpc();
    } catch (e) {}

    await kycProgram.methods
      .registerUser(kycHash, riskScore, false, false, expiresAt)
      .accounts({
        authority: authority.publicKey,
        kycRecord: kycRecordPda,
        walletAddress: user,
        registryConfig: PublicKey.findProgramAddressSync([Buffer.from("registry_config")], kycProgram.programId)[0],
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    return kycRecordPda;
  }

  it("Initializes the vault", async () => {
    await vaultProgram.methods
      .initializeVault(depositLimit, travelRuleThreshold, kycProgram.programId)
      .accounts({
        authority: authority.publicKey,
        vaultConfig: vaultConfigPda,
        vaultTokenAccount: vaultTokenAccount,
        usdc_mint: usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const config = await vaultProgram.account.vaultConfig.fetch(vaultConfigPda);
    expect(config.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(config.kycRegistryProgram.toBase58()).to.equal(kycProgram.programId.toBase58());
    expect(config.usdcMint.toBase58()).to.equal(usdcMint.toBase58());
    expect(config.paused).to.be.false;
  });

  it("Deposits USDC with approved KYC", async () => {
    const user = Keypair.generate();
    const signature = await provider.connection.requestAirdrop(user.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature);

    const kycRecordPda = await createKycRecord(user.publicKey, "approved");

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority,
        usdcMint,
        user.publicKey
    );

    const amount = new anchor.BN(2_000_000); // 2 USDC
    await mintTo(
        provider.connection,
        authority,
        usdcMint,
        userTokenAccount.address,
        authority,
        amount.toNumber()
    );

    const [userVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_vault"), user.publicKey.toBuffer()],
        vaultProgram.programId
    );

    await vaultProgram.methods
        .deposit(amount)
        .accounts({
            user: user.publicKey,
            userVaultAccount: userVaultPda,
            userTokenAccount: userTokenAccount.address,
            vaultTokenAccount: vaultTokenAccount,
            kycRecord: kycRecordPda,
            vaultConfig: vaultConfigPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        } as any)
        .signers([user])
        .rpc();

    const userVault = await vaultProgram.account.userVaultAccount.fetch(userVaultPda);
    expect(userVault.depositedAmount.toString()).to.equal(amount.toString());
  });

  it("Fails to deposit with expired KYC", async () => {
    const user = Keypair.generate();
    const signature = await provider.connection.requestAirdrop(user.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature);

    const kycRecordPda = await createKycRecord(user.publicKey, "expired");

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority,
        usdcMint,
        user.publicKey
    );

    const amount = new anchor.BN(1_000_000);
    const [userVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_vault"), user.publicKey.toBuffer()],
        vaultProgram.programId
    );

    try {
        await vaultProgram.methods
            .deposit(amount)
            .accounts({
                user: user.publicKey,
                userVaultAccount: userVaultPda,
                userTokenAccount: userTokenAccount.address,
                vaultTokenAccount: vaultTokenAccount,
                kycRecord: kycRecordPda,
                vaultConfig: vaultConfigPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([user])
            .rpc();
        expect.fail("Should have failed with KycExpired");
    } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("KycExpired");
    }
  });

  it("Fails to deposit exceeding limit", async () => {
    const user = Keypair.generate();
    const signature = await provider.connection.requestAirdrop(user.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature);

    const kycRecordPda = await createKycRecord(user.publicKey, "approved");

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority,
        usdcMint,
        user.publicKey
    );

    const amount = depositLimit.add(new anchor.BN(1));
    await mintTo(
        provider.connection,
        authority,
        usdcMint,
        userTokenAccount.address,
        authority,
        amount.toNumber()
    );

    const [userVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_vault"), user.publicKey.toBuffer()],
        vaultProgram.programId
    );

    try {
        await vaultProgram.methods
            .deposit(amount)
            .accounts({
                user: user.publicKey,
                userVaultAccount: userVaultPda,
                userTokenAccount: userTokenAccount.address,
                vaultTokenAccount: vaultTokenAccount,
                kycRecord: kycRecordPda,
                vaultConfig: vaultConfigPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([user])
            .rpc();
        expect.fail("Should have failed with DepositLimitExceeded");
    } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("DepositLimitExceeded");
    }
  });

  it("Fails to deposit when paused", async () => {
    // Pause vault
    await vaultProgram.methods.pauseVault().accounts({
        authority: authority.publicKey,
        vaultConfig: vaultConfigPda,
    } as any).rpc();

    const user = Keypair.generate();
    const signature = await provider.connection.requestAirdrop(user.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature);
    const kycRecordPda = await createKycRecord(user.publicKey, "approved");
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority,
        usdcMint,
        user.publicKey
    );
    const [userVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_vault"), user.publicKey.toBuffer()],
        vaultProgram.programId
    );

    try {
        await vaultProgram.methods
            .deposit(new anchor.BN(100))
            .accounts({
                user: user.publicKey,
                userVaultAccount: userVaultPda,
                userTokenAccount: userTokenAccount.address,
                vaultTokenAccount: vaultTokenAccount,
                kycRecord: kycRecordPda,
                vaultConfig: vaultConfigPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any)
            .signers([user])
            .rpc();
        expect.fail("Should have failed with VaultPaused");
    } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("VaultPaused");
    }

    // Unpause for other tests
    await vaultProgram.methods.unpauseVault().accounts({
        authority: authority.publicKey,
        vaultConfig: vaultConfigPda,
    } as any).rpc();
  });

  it("Fails to withdraw more than balance", async () => {
    const user = Keypair.generate();
    const signature = await provider.connection.requestAirdrop(user.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature);
    const kycRecordPda = await createKycRecord(user.publicKey, "approved");
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority,
        usdcMint,
        user.publicKey
    );
    const [userVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_vault"), user.publicKey.toBuffer()],
        vaultProgram.programId
    );

    try {
        await vaultProgram.methods
            .withdraw(new anchor.BN(100))
            .accounts({
                user: user.publicKey,
                userVaultAccount: userVaultPda,
                userTokenAccount: userTokenAccount.address,
                vaultTokenAccount: vaultTokenAccount,
                vaultConfig: vaultConfigPda,
                kycRecord: kycRecordPda,
                tokenProgram: TOKEN_PROGRAM_ID,
            } as any)
            .signers([user])
            .rpc();
        expect.fail("Should have failed with InsufficientBalance");
    } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InsufficientBalance");
    }
  });
});
