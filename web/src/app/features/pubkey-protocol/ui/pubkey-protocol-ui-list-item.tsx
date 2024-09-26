import { Group, Stack } from '@mantine/core'
import { PubKeyProfile } from '@pubkey-protocol/anchor'
import { UiCard, UiDebugModal, UiGroup } from '@pubkey-ui/core'
import { ReactNode } from 'react'
import { ellipsify } from '../../../ui'
import { ExplorerLink } from '../../cluster/cluster-ui'
import { PubkeyProtocolUiAnchor } from './pubkey-protocol-ui-anchor'
import { PubkeyProtocolUiAvatar } from './pubkey-protocol-ui-avatar'

export function PubkeyProtocolUiListItem({
  children,
  profile,
  basePath,
}: {
  children?: ReactNode
  profile: PubKeyProfile
  basePath?: string
}) {
  return (
    <UiCard>
      <UiGroup align="start">
        <Group align="center" wrap="nowrap" gap="xs">
          <PubkeyProtocolUiAvatar profile={profile} />
          <Stack gap={0}>
            <PubkeyProtocolUiAnchor username={profile.username} basePath={basePath} />
            <ExplorerLink
              size="xs"
              ff="mono"
              path={`account/${profile.publicKey}`}
              label={ellipsify(profile.publicKey.toString())}
            />
          </Stack>
        </Group>
        <Group gap="xs">
          <UiDebugModal size="lg" data={profile} />
        </Group>
      </UiGroup>
      {children}
    </UiCard>
  )
}
