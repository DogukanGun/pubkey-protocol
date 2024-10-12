// - Check if the identity can be removed and then added again and make sure it can only be done by the profile acc
import * as anchor from '@coral-xyz/anchor'
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js'
import { getPubKeyPointerPda, getPubKeyProfilePda, PubKeyIdentityProvider, pubKeyIdentityProviderArgs, PubkeyProtocol } from '../src'
import { unique } from './utils/unique'
import { createTestCommunity, createTestProfile } from './utils'

describe('Identity Profile Verification', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const feePayer = provider.wallet as anchor.Wallet
  const program = anchor.workspace.PubkeyProtocol as anchor.Program<PubkeyProtocol>

  let testProfile: anchor.web3.PublicKey
  const username = unique('timmy')
  const communityAuthority = Keypair.generate()
  const profileOwner = Keypair.generate()
  let community: anchor.web3.PublicKey

  beforeAll(async () => {
    await provider.connection.requestAirdrop(profileOwner.publicKey, LAMPORTS_PER_SOL)

    const slug = unique('pubkey')    
    await createTestCommunity(slug, program, communityAuthority, feePayer.publicKey)
    await createTestProfile(username, program, profileOwner, feePayer.publicKey)
  })

  it('Add Identity', async () => {
    const [profile] = getPubKeyProfilePda({ username, programId: program.programId })
    const [pointer, bump] = getPubKeyPointerPda({
      programId: program.programId,
      provider: PubKeyIdentityProvider.Solana,
      providerId: communityAuthority.publicKey.toBase58(),
    })
    const input = {
      providerId: communityAuthority.publicKey.toBase58(),
      provider: pubKeyIdentityProviderArgs.Solana,
      name: `${username}_wallet`,
    }
    await program.methods
      .addIdentity(input)
      .accountsStrict({
        authority: communityAuthority.publicKey,
        feePayer: feePayer.publicKey,
        pointer,
        profile,
        systemProgram: SystemProgram.programId,
      })
      .signers([communityAuthority])
      .rpc()

    const { identities } = await program.account.profile.fetch(profile)
    const pointerData = await program.account.pointer.fetch(pointer)

    const postBalance = await provider.connection.getBalance(communityAuthority.publicKey)

    expect(postBalance).toStrictEqual(LAMPORTS_PER_SOL)
    expect(identities).toEqual([
      {
        provider: pubKeyIdentityProviderArgs.Solana,
        providerId: communityAuthority.publicKey,
        name: 'Primary Wallet',
        communities: [],
      },
      {
        provider: pubKeyIdentityProviderArgs.Discord,
        providerId: { string: input.providerId },
        name: input.name,
        communities: [],
      },
    ])

    expect(pointerData.bump).toStrictEqual(bump)
    expect(pointerData.providerId).toStrictEqual(input.providerId)
    expect(pointerData.provider).toStrictEqual(pubKeyIdentityProviderArgs.Discord)
    expect(pointerData.profile).toStrictEqual(profile)
  })

  it('Remove Identity', async () => {
    const [profile] = getPubKeyProfilePda({ username, programId: program.programId })
    const [pointer] = getPubKeyPointerPda({
      programId: program.programId,
      providerId: `${username}-discord-id-123`,
      provider: PubKeyIdentityProvider.Discord,
    })

    await program.methods
      .removeIdentity({ provider: pubKeyIdentityProviderArgs.Discord, providerId: `${username}-discord-id-123` })
      .accountsStrict({
        authority: profileOwner.publicKey,
        feePayer: feePayer.publicKey,
        pointer,
        profile,
        systemProgram: SystemProgram.programId,
      })
      .signers([profileOwner])
      .rpc()

    const { identities } = await program.account.profile.fetch(profile)
    const pointerData = await program.account.pointer.fetchNullable(pointer)

    expect(identities).toEqual([
      {
        provider: pubKeyIdentityProviderArgs.Solana,
        providerId: profileOwner.publicKey.toString(),
        name: 'Primary Wallet',
      },
    ])
    expect(pointerData).toBeNull()
  })

  it('Verify Profile for Community', async () => {
    await program.methods
      .verifyProfileForCommunity({
        provider: pubKeyIdentityProviderArgs.Discord,
      })
      .accountsStrict({
        community,
        profile: testProfile,
        authority: communityAuthority.publicKey,
        feePayer: feePayer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([communityAuthority])
      .rpc()

    // Fetch and check the Profile account
    const profileAccount = await program.account.profile.fetch(testProfile)
    const identityVerification = profileAccount.identities.find(
      (i) => i.provider === pubKeyIdentityProviderArgs.Solana
    )
    expect(identityVerification).toBeDefined()
    if (identityVerification) {
      expect(identityVerification.communities).toContainEqual(community)
    }

    // Fetch and check the Community account
    const communityAccount = await program.account.community.fetch(community)
    expect(communityAccount.providers).toContain(pubKeyIdentityProviderArgs.Solana)
  })

  it('Fails to Verify Profile for Community with Unauthorized Authority', async () => {
    const unauthorizedAuthority = Keypair.generate()

    await expect(
      program.methods
        .verifyProfileForCommunity(
          { provider: pubKeyIdentityProviderArgs.Discord },
        )
        .accountsStrict({
          community,
          profile: testProfile,
          authority: unauthorizedAuthority.publicKey,
          feePayer: feePayer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedAuthority])
        .rpc(),
    ).rejects.toThrow(/Unauthorized/)
  })
})