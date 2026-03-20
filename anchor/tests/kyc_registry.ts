import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KycRegistry } from "../target/types/kyc_registry";
import { expect } from "chai";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import * as crypto from "crypto";

describe("kyc_registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KycRegistry as Program<KycRegistry>;
  const authority = provider.wallet as anchor.Wallet;

  const [registryConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry_config")],
    program.programId
  );

  it("Initializes the registry", async () => {
    await program.methods
      .initializeRegistry()
      .accounts({
        authority: authority.publicKey,
        registryConfig: registryConfigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const config = await program.account.registryConfig.fetch(registryConfigPda);
    expect(config.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(config.paused).to.be.false;
  });

  it("Registers a user (Approved)", async () => {
    const user = Keypair.generate();
    const kycHash = Array.from(crypto.createHash("sha256").update("user_data").digest());
    const riskScore = 500;
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);

    const [kycRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .registerUser(kycHash, riskScore, false, false, expiresAt)
      .accounts({
        authority: authority.publicKey,
        kycRecord: kycRecordPda,
        walletAddress: user.publicKey,
        registryConfig: registryConfigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const record = await program.account.kycRecord.fetch(kycRecordPda);
    expect(record.wallet.toBase58()).to.equal(user.publicKey.toBase58());
    expect(JSON.stringify(record.kycHash)).to.equal(JSON.stringify(kycHash));
    expect(record.riskScore).to.equal(riskScore);
    expect(record.pepFlag).to.be.false;
    expect(record.sanctionsFlag).to.be.false;
    expect(Object.keys(record.status)[0]).to.equal("approved");
  });

  it("Registers a user (Rejected due to PEP)", async () => {
    const user = Keypair.generate();
    const kycHash = Array.from(crypto.createHash("sha256").update("pep_user").digest());
    const riskScore = 100;
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);

    const [kycRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .registerUser(kycHash, riskScore, true, false, expiresAt)
      .accounts({
        authority: authority.publicKey,
        kycRecord: kycRecordPda,
        walletAddress: user.publicKey,
        registryConfig: registryConfigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const record = await program.account.kycRecord.fetch(kycRecordPda);
    expect(Object.keys(record.status)[0]).to.equal("rejected");
  });

  it("Registers a user (Rejected due to high risk score)", async () => {
    const user = Keypair.generate();
    const kycHash = Array.from(crypto.createHash("sha256").update("high_risk").digest());
    const riskScore = 800;
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);

    const [kycRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .registerUser(kycHash, riskScore, false, false, expiresAt)
      .accounts({
        authority: authority.publicKey,
        kycRecord: kycRecordPda,
        walletAddress: user.publicKey,
        registryConfig: registryConfigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const record = await program.account.kycRecord.fetch(kycRecordPda);
    expect(Object.keys(record.status)[0]).to.equal("rejected");
  });

  it("Revokes KYC", async () => {
    const user = Keypair.generate();
    const kycHash = Array.from(crypto.createHash("sha256").update("revoke_test").digest());
    const riskScore = 300;
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);

    const [kycRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .registerUser(kycHash, riskScore, false, false, expiresAt)
      .accounts({
        authority: authority.publicKey,
        kycRecord: kycRecordPda,
        walletAddress: user.publicKey,
        registryConfig: registryConfigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    await program.methods
      .revokeKyc()
      .accounts({
        authority: authority.publicKey,
        kycRecord: kycRecordPda,
        registryConfig: registryConfigPda,
      } as any)
      .rpc();

    const record = await program.account.kycRecord.fetch(kycRecordPda);
    expect(Object.keys(record.status)[0]).to.equal("rejected");
  });

  it("Fails with unauthorized signer", async () => {
    const unauthorizedUser = Keypair.generate();
    const user = Keypair.generate();
    const kycHash = Array.from(crypto.createHash("sha256").update("unauthorized").digest());
    const riskScore = 100;
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);

    const [kycRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), user.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .registerUser(kycHash, riskScore, false, false, expiresAt)
        .accounts({
          authority: unauthorizedUser.publicKey,
          kycRecord: kycRecordPda,
          walletAddress: user.publicKey,
          registryConfig: registryConfigPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([unauthorizedUser])
        .rpc();
      expect.fail("Should have failed");
    } catch (err: any) {
        // console.log(err);
      expect(err.error.errorCode.code).to.equal("Unauthorized");
    }
  });

  it("Fails with invalid risk score", async () => {
    const user = Keypair.generate();
    const kycHash = Array.from(crypto.createHash("sha256").update("invalid_risk").digest());
    const riskScore = 1100;
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);

    const [kycRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), user.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .registerUser(kycHash, riskScore, false, false, expiresAt)
        .accounts({
          authority: authority.publicKey,
          kycRecord: kycRecordPda,
          walletAddress: user.publicKey,
          registryConfig: registryConfigPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      expect.fail("Should have failed");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InvalidRiskScore");
    }
  });
});
