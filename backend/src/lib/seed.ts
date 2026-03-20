import { prisma } from './prisma'
import { KycStatus } from '@prisma/client'

async function main() {
  console.log('Seeding database...')

  // Seed VaultState singleton
  const vaultState = await prisma.vaultState.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      totalDeposited: 0,
      totalWithdrawn: 0,
      activeUsers: 0,
    },
  })
  console.log('VaultState seeded:', vaultState)

  // Seed test user with approved KYC
  const testUser = await prisma.user.upsert({
    where: { walletAddress: 'TEST_WALLET_ADDRESS' },
    update: {},
    create: {
      walletAddress: 'TEST_WALLET_ADDRESS',
      email: 'test@example.com',
      fullName: 'Test User',
      kycRecord: {
        create: {
          status: KycStatus.APPROVED,
          riskScore: 0.0,
          approvedAt: new Date(),
        },
      },
    },
  })
  console.log('Test user seeded:', testUser)

  console.log('Seeding completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
