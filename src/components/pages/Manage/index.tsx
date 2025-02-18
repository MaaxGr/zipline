import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Code,
  ColorInput,
  CopyButton,
  FileInput,
  Group,
  Image,
  List,
  PasswordInput,
  SimpleGrid,
  Space,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { randomId, useInterval, useMediaQuery } from '@mantine/hooks';
import { useModals } from '@mantine/modals';
import { showNotification, updateNotification } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBrandDiscordFilled,
  IconBrandGithubFilled,
  IconBrandGoogle,
  IconCheck,
  IconClipboardCopy,
  IconFileExport,
  IconFiles,
  IconFilesOff,
  IconFileZip,
  IconGraph,
  IconGraphOff,
  IconPhotoMinus,
  IconReload,
  IconTrash,
  IconUserCheck,
  IconUserCog,
  IconUserExclamation,
  IconUserMinus,
  IconUserX,
  IconX,
} from '@tabler/icons-react';
import AnchorNext from 'components/AnchorNext';
import { FlameshotIcon, ShareXIcon } from 'components/icons';
import MutedText from 'components/MutedText';
import { SmallTable } from 'components/SmallTable';
import useFetch from 'hooks/useFetch';
import { userSelector } from 'lib/recoil/user';
import { bytesToHuman } from 'lib/utils/bytes';
import { capitalize } from 'lib/utils/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import ClearStorage from './ClearStorage';
import Flameshot from './Flameshot';
import ShareX from './ShareX';
import { TotpModal } from './TotpModal';

function ExportDataTooltip({ children }) {
  return (
    <Tooltip
      position='top'
      color=''
      label='After clicking, if you have a lot of files the export can take a while to complete. A list of previous exports will be below to download.'
    >
      {children}
    </Tooltip>
  );
}

export default function Manage({ oauth_registration, oauth_providers: raw_oauth_providers, totp_enabled }) {
  const oauth_providers = JSON.parse(raw_oauth_providers);
  const icons = {
    Discord: IconBrandDiscordFilled,
    GitHub: IconBrandGithubFilled,
    Google: IconBrandGoogle,
  };

  for (const provider of oauth_providers) {
    provider.Icon = icons[provider.name];
  }

  const [user, setUser] = useRecoilState(userSelector);
  const modals = useModals();

  const [totpOpen, setTotpOpen] = useState(false);
  const [shareXOpen, setShareXOpen] = useState(false);
  const [flameshotOpen, setFlameshotOpen] = useState(false);
  const [clrStorOpen, setClrStorOpen] = useState(false);
  const [exports, setExports] = useState([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileDataURL, setFileDataURL] = useState(user.avatar ?? null);
  const [totpEnabled, setTotpEnabled] = useState(!!user.totpSecret);
  const [tokenShown, setTokenShown] = useState(false);

  const getDataURL = (f: File): Promise<string> => {
    return new Promise((res, rej) => {
      const reader = new FileReader();

      reader.addEventListener('load', () => {
        res(reader.result as string);
      });

      reader.addEventListener('error', () => {
        rej(reader.error);
      });

      reader.readAsDataURL(f);
    });
  };

  const handleAvatarChange = async (file: File) => {
    setFile(file);

    if (file) setFileDataURL(await getDataURL(file));
  };

  const saveAvatar = async () => {
    let dataURL = null;

    if (file) dataURL = await getDataURL(file);

    showNotification({
      id: 'update-user',
      title: 'Updating user...',
      message: '',
      loading: true,
      autoClose: false,
    });

    const newUser = await useFetch('/api/user', 'PATCH', {
      avatar: dataURL,
      ...(!dataURL && { resetAvatar: true }),
    });

    if (newUser.error) {
      updateNotification({
        id: 'update-user',
        title: "Couldn't save user",
        message: newUser.error,
        color: 'red',
        icon: <IconUserX size='1rem' />,
      });
    } else {
      setUser(newUser);
      updateNotification({
        id: 'update-user',
        title: 'Saved User',
        message: '',
        color: 'green',
        icon: <IconUserCheck size='1rem' />,
      });
    }
  };

  const form = useForm({
    initialValues: {
      username: user.username,
      password: '',
      embedTitle: user.embed?.title ?? null,
      embedColor: user.embed?.color ?? '',
      embedSiteName: user.embed?.siteName ?? null,
      embedDescription: user.embed?.description ?? null,
      domains: user.domains.join(','),
    },
  });

  const onSubmit = async (values) => {
    const cleanUsername = values.username.trim();
    const cleanPassword = values.password.trim();
    const cleanEmbed = {
      title: values.embedTitle ? values.embedTitle.trim() : null,
      color: values.embedColor !== '' ? values.embedColor.trim() : null,
      siteName: values.embedSiteName ? values.embedSiteName.trim() : null,
      description: values.embedDescription ? values.embedDescription.trim() : null,
    };

    if (cleanUsername === '') return form.setFieldError('username', "Username can't be nothing");

    showNotification({
      id: 'update-user',
      title: 'Updating user...',
      message: '',
      loading: true,
      autoClose: false,
    });

    const data = {
      username: cleanUsername,
      password: cleanPassword === '' ? null : cleanPassword,
      domains: values.domains
        .split(/\s?,\s?/)
        .map((x) => x.trim())
        .filter((x) => x !== ''),
      embed: cleanEmbed,
    };

    const newUser = await useFetch('/api/user', 'PATCH', data);

    if (newUser.error) {
      if (newUser.invalidDomains) {
        updateNotification({
          id: 'update-user',
          message: (
            <>
              <Text mt='xs'>The following domains are invalid:</Text>
              {newUser.invalidDomains.map((err) => (
                <>
                  <Text color='gray' key={randomId()}>
                    {err.domain}: {err.reason}
                  </Text>
                  <Space h='md' />
                </>
              ))}
            </>
          ),
          color: 'red',
          icon: <IconUserX size='1rem' />,
        });
      }
      updateNotification({
        id: 'update-user',
        title: "Couldn't save user",
        message: newUser.error,
        color: 'red',
        icon: <IconUserX size='1rem' />,
      });
    } else {
      setUser(newUser);
      updateNotification({
        id: 'update-user',
        title: 'Saved User',
        message: '',
        color: 'green',
        icon: <IconUserCheck size='1rem' />,
      });
    }
  };

  const exportData = async () => {
    const res = await useFetch('/api/user/export', 'POST');
    if (res.url) {
      showNotification({
        title: 'Export started...',
        loading: true,
        message:
          'If you have a lot of files, the export may take a while. The list of exports will be updated every 30s.',
      });
    } else {
      showNotification({
        title: 'Error exporting data',
        message: res.error,
        color: 'red',
        icon: <IconFileExport size='1rem' />,
      });
    }
  };

  const getExports = async () => {
    const res = await useFetch('/api/user/export');

    setExports(
      res.exports
        ?.map((s) => ({
          date: new Date(s.createdAt),
          size: s.size,
          full: s.name,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    );
  };

  const deleteExport = async (name) => {
    const res = await useFetch('/api/user/export?name=' + name, 'DELETE');
    if (res.error) {
      showNotification({
        title: 'Error deleting export',
        message: res.error,
        color: 'red',
        icon: <IconX size='1rem' />,
      });
    } else {
      showNotification({
        message: 'Deleted export',
        color: 'green',
        icon: <IconFileZip size='1rem' />,
      });

      await getExports();
    }
  };

  const handleDelete = async () => {
    const res = await useFetch('/api/user/files', 'DELETE', {
      all: true,
    });

    if (!res.count) {
      showNotification({
        title: "Couldn't delete files",
        message: res.error,
        color: 'red',
        icon: <IconFilesOff size='1rem' />,
      });
    } else {
      showNotification({
        title: 'Deleted files',
        message: `${res.count} files deleted`,
        color: 'green',
        icon: <IconFiles size='1rem' />,
      });
    }
  };

  const openDeleteModal = () =>
    modals.openConfirmModal({
      title: 'Are you sure you want to delete all of your files?',
      closeOnConfirm: false,
      labels: { confirm: 'Yes', cancel: 'No' },
      onConfirm: () => {
        modals.openConfirmModal({
          title: 'Are you really sure?',
          labels: { confirm: 'Yes', cancel: 'No' },
          onConfirm: () => {
            handleDelete();
            modals.closeAll();
          },
          onCancel: () => {
            modals.closeAll();
          },
        });
      },
    });

  const forceUpdateStats = async () => {
    const res = await useFetch('/api/stats', 'POST');
    if (res.error) {
      showNotification({
        title: 'Error updating stats',
        message: res.error,
        color: 'red',
        icon: <IconGraphOff size='1rem' />,
      });
    } else {
      showNotification({
        title: 'Updated stats',
        message: '',
        color: 'green',
        icon: <IconGraph size='1rem' />,
      });
    }
  };

  const handleOauthUnlink = async (provider) => {
    const res = await useFetch('/api/auth/oauth', 'DELETE', {
      provider,
    });
    if (res.error) {
      showNotification({
        title: 'Error while unlinking from OAuth',
        message: res.error,
        color: 'red',
        icon: <IconUserExclamation size='1rem' />,
      });
    } else {
      setUser(res);
      showNotification({
        title: `Unlinked from ${provider[0] + provider.slice(1).toLowerCase()}`,
        message: '',
        color: 'green',
        icon: <IconUserMinus size='1rem' />,
      });
    }
  };

  const startFullExport = () => {
    modals.openConfirmModal({
      title: <Title>Are you sure?</Title>,
      size: 'xl',
      children: (
        <Box px='md'>
          <Alert color='red' icon={<IconAlertCircle size='1rem' />} title='Warning'>
            This export contains a significant amount of sensitive data, including user information,
            passwords, metadata, and system details. It is crucial to handle this file with care to prevent
            unauthorized access or misuse. Ensure it is stored securely and shared only with trusted parties.
          </Alert>

          <p>
            The export provides a snapshot of Zipline&apos;s data and environment. Specifically, it includes:
          </p>

          <List>
            <List.Item>
              <b>User Data:</b> Information about users, avatars, passwords, and registered OAuth providers.
            </List.Item>
            <List.Item>
              <b>Files:</b> Metadata about uploaded files including filenames, passwords, sizes, and
              timestamps, linked users. <i>(Note: the actual contents of the files are not included.)</i>
            </List.Item>
            <List.Item>
              <b>URLs:</b> Metadata about shortened URLs, including the original URL, short URL, and vanity.
            </List.Item>
            <List.Item>
              <b>Folders:</b> Metadata about folders, including names, visibility settings, and files.
            </List.Item>
            <List.Item>
              <b>Thumbnails:</b> Metadata about thumbnails, includes the name and creation timestamp.{' '}
              <i>(Actual image data is excluded.)</i>
            </List.Item>
            <List.Item>
              <b>Invites:</b> Metadata about invites, includes the invite code, creator, and expiration date.
            </List.Item>
            <List.Item>
              <b>Statistics:</b> Usage data that is used on the statistics page, including upload counts and
              such.
            </List.Item>
          </List>
          <p>
            Additionally, the export captures <b>system-specific information</b>:
          </p>
          <List>
            <List.Item>
              <b>CPU Count:</b> The number of processing cores available on the host system.
            </List.Item>
            <List.Item>
              <b>Hostname:</b> The network identifier of the host system.
            </List.Item>
            <List.Item>
              <b>Architecture:</b> The hardware architecture (e.g., <Code>x86</Code>, <Code>arm</Code>) on
              which Zipline is running.
            </List.Item>
            <List.Item>
              <b>Platform:</b> The operating system platform (e.g., <Code>linux</Code>, <Code>darwin</Code>)
              on which Zipline is running.
            </List.Item>
            <List.Item>
              <b>Version:</b> The current version of the operating system (kernel version)
            </List.Item>
            <List.Item>
              <b>Environment Variables:</b> The configuration settings and variables defined at the time of
              execution.
            </List.Item>
          </List>

          <p>
            <i>Note:</i> By omitting the actual contents of files and thumbnails while including their
            metadata, the export ensures it captures enough detail for migration to another instance, or for
            v4.
          </p>
        </Box>
      ),
      labels: { confirm: 'Yes', cancel: 'No' },
      cancelProps: { color: 'red' },
      onConfirm: async () => {
        modals.closeAll();
        showNotification({
          title: 'Exporting all server data...',
          message: 'This may take a while depending on the amount of data.',
          loading: true,
          id: 'export-all',
          autoClose: false,
        });

        const res = await useFetch('/api/admin/export', 'GET');
        if (res.error) {
          updateNotification({
            id: 'export-all',
            title: 'Error exporting data',
            message: res.error,
            color: 'red',
            icon: <IconFileExport size='1rem' />,
            autoClose: true,
          });
        } else {
          updateNotification({
            title: 'Export created',
            message: 'Your browser will prompt you to download a JSON file with all the server data.',
            id: 'export-all',
            color: 'green',
            icon: <IconFileExport size='1rem' />,
            autoClose: true,
          });

          const blob = new Blob([JSON.stringify(res)], { type: 'application/json' });
          const a = document.createElement('a');
          a.style.display = 'none';
          const url = URL.createObjectURL(blob);
          console.log(url, res);
          a.setAttribute('download', `zipline_export_${Date.now()}.json`);
          a.setAttribute('href', url);
          a.click();

          URL.revokeObjectURL(url);
        }
      },
    });
  };

  const interval = useInterval(() => getExports(), 30000);
  useEffect(() => {
    getExports();
    interval.start();
    setTotpEnabled(() => !!user.totpSecret);
  }, [user]);

  return (
    <>
      <Title>Manage User</Title>
      <MutedText size='md'>
        Want to use variables in embed text? Visit{' '}
        <AnchorNext href='https://zipline.diced.sh/docs/guides/variables'>the docs</AnchorNext> for variables
      </MutedText>

      <TextInput
        rightSection={
          <CopyButton value={user.token} timeout={1000}>
            {({ copied, copy }) => (
              <ActionIcon onClick={copy}>
                {copied ? <IconCheck color='green' size='1rem' /> : <IconClipboardCopy size='1rem' />}
              </ActionIcon>
            )}
          </CopyButton>
        }
        // @ts-ignore (this works even though ts doesn't allow for it)
        component='span'
        label='Token'
        onClick={() => setTokenShown(true)}
      >
        {tokenShown ? user.token : '[click to reveal]'}
      </TextInput>

      <form onSubmit={form.onSubmit((v) => onSubmit(v))}>
        <TextInput id='username' label='Username' my='sm' {...form.getInputProps('username')} />
        <PasswordInput
          id='password'
          label='Password'
          description='Leave blank to keep your old password'
          my='sm'
          {...form.getInputProps('password')}
        />

        <SimpleGrid
          cols={4}
          breakpoints={[
            { maxWidth: 768, cols: 1 },
            { minWidth: 769, maxWidth: 1024, cols: 2 },
            { minWidth: 1281, cols: 4 },
          ]}
        >
          <TextInput id='embedTitle' label='Embed Title' my='sm' {...form.getInputProps('embedTitle')} />
          <ColorInput id='embedColor' label='Embed Color' my='sm' {...form.getInputProps('embedColor')} />
          <TextInput
            id='embedSiteName'
            label='Embed Site Name'
            my='sm'
            {...form.getInputProps('embedSiteName')}
          />
          <TextInput
            id='embedDescription'
            label='Embed Description'
            my='sm'
            {...form.getInputProps('embedDescription')}
          />
        </SimpleGrid>

        <TextInput
          id='domains'
          label='Domains'
          description='A list of domains separated by commas. These domains will be used to randomly output a domain when uploading. This is optional.'
          placeholder='https://example.com, https://example2.com'
          my='sm'
          {...form.getInputProps('domains')}
        />

        <Group position='right' mt='md'>
          <Button
            type='submit'
            size='lg'
            my='sm'
            sx={{
              '@media screen and (max-width: 768px)': {
                width: '100%',
              },
            }}
          >
            Save
          </Button>
        </Group>
      </form>

      {totp_enabled && (
        <Box my='md'>
          <Title>Two Factor Authentication</Title>
          <MutedText size='md'>
            {totpEnabled
              ? 'You have two factor authentication enabled.'
              : 'You do not have two factor authentication enabled.'}
          </MutedText>

          <Button
            size='lg'
            my='sm'
            onClick={() => setTotpOpen(true)}
            sx={{
              '@media screen and (max-width: 768px)': {
                width: '100%',
              },
            }}
          >
            {totpEnabled ? 'Disable' : 'Enable'} Two Factor Authentication
          </Button>

          <TotpModal
            opened={totpOpen}
            onClose={() => setTotpOpen(false)}
            deleteTotp={totpEnabled}
            setUser={setUser}
          />
        </Box>
      )}

      {oauth_registration && (
        <Box my='md'>
          <Title>OAuth</Title>
          <MutedText size='md'>Link your account with an OAuth provider.</MutedText>

          <Group>
            {oauth_providers
              .filter(
                (x) =>
                  !user.oauth?.map(({ provider }) => provider.toLowerCase()).includes(x.name.toLowerCase()),
              )
              .map(({ link_url, name, Icon }, i) => (
                <Button key={i} size='lg' leftIcon={<Icon />} component={Link} href={link_url} my='sm'>
                  Link account with {name}
                </Button>
              ))}

            {user?.oauth?.map(({ provider }, i) => (
              <Button
                key={i}
                onClick={() => handleOauthUnlink(provider)}
                size='lg'
                leftIcon={<IconTrash size='1rem' />}
                my='sm'
                color='red'
              >
                Unlink account with {capitalize(provider)}
              </Button>
            ))}
          </Group>
        </Box>
      )}

      <Box my='md'>
        <Title>Avatar</Title>
        <FileInput
          placeholder='Click to upload a file'
          id='file'
          description='Add a custom avatar or leave blank for none'
          accept='image/png,image/jpeg,image/gif'
          value={file}
          onChange={handleAvatarChange}
        />
        <Card mt='md'>
          <Text>Preview:</Text>
          <Button
            leftIcon={
              fileDataURL ? (
                <Image src={fileDataURL} height={32} width={32} radius='md' />
              ) : (
                <IconUserCog size='1rem' />
              )
            }
            size='xl'
            p='sm'
            variant='subtle'
            color='gray'
            compact
          >
            {user.username}
          </Button>
        </Card>

        <Group position='right' my='md' grow={useMediaQuery('(max-width: 768px)')}>
          <Button
            onClick={() => {
              setFile(null);
              setFileDataURL(null);
            }}
            color='red'
          >
            Reset
          </Button>
          <Button onClick={saveAvatar}>Save Avatar</Button>
        </Group>
      </Box>

      <Box my='md'>
        <Title>Manage Data</Title>
        <MutedText size='md'>Delete, or export your data into a zip file.</MutedText>
      </Box>

      <Group my='md' grow={useMediaQuery('(max-width: 768px)')}>
        <Button onClick={openDeleteModal} rightIcon={<IconPhotoMinus size='1rem' />} color='red'>
          Delete All Data
        </Button>
        <ExportDataTooltip>
          <Button onClick={exportData} rightIcon={<IconFileZip size='1rem' />}>
            Export Data
          </Button>
        </ExportDataTooltip>
        <Button onClick={getExports} rightIcon={<IconReload size='1rem' />}>
          Refresh
        </Button>
      </Group>
      <Card mt='md'>
        {exports && exports.length ? (
          <SmallTable
            columns={[
              { id: 'name', name: 'Name' },
              { id: 'date', name: 'Date' },
              { id: 'size', name: 'Size' },
              { id: 'actions', name: '' },
            ]}
            rows={
              exports
                ? exports.map((x, i) => ({
                    name: (
                      <Anchor target='_blank' href={'/api/user/export?name=' + x.full}>
                        Export {i + 1}
                      </Anchor>
                    ),
                    date: x.date.toLocaleString(),
                    size: bytesToHuman(x.size),
                    actions: (
                      <ActionIcon onClick={() => deleteExport(x.full)}>
                        <IconTrash size='1rem' />
                      </ActionIcon>
                    ),
                  }))
                : []
            }
          />
        ) : (
          <Text>No exports yet</Text>
        )}
      </Card>

      {user.administrator && (
        <Box mt='md'>
          <Title>Server</Title>
          <Group my='md' grow={useMediaQuery('(max-width: 768px)')}>
            <Button size='md' onClick={forceUpdateStats} color='red' rightIcon={<IconReload size='1rem' />}>
              Force Update Stats
            </Button>
            <Button
              size='md'
              onClick={() => setClrStorOpen(true)}
              color='red'
              rightIcon={<IconTrash size='1rem' />}
            >
              Delete all uploads
            </Button>
            {user.superAdmin && (
              <Button size='md' onClick={startFullExport} rightIcon={<IconFileExport size='1rem' />}>
                Export all server data (JSON)
              </Button>
            )}
          </Group>
        </Box>
      )}

      <Title my='md'>Uploaders</Title>
      <Group>
        <Button
          size='xl'
          onClick={() => setShareXOpen(true)}
          rightIcon={<ShareXIcon size='1rem' />}
          sx={{
            '@media screen and (max-width: 768px)': {
              width: '100%',
            },
          }}
        >
          Generate ShareX Config
        </Button>
        <Button
          size='xl'
          onClick={() => setFlameshotOpen(true)}
          rightIcon={<FlameshotIcon size='1rem' />}
          sx={{
            '@media screen and (max-width: 768px)': {
              width: '100%',
            },
          }}
        >
          Generate Flameshot Script
        </Button>
      </Group>

      <ShareX user={user} open={shareXOpen} setOpen={setShareXOpen} />
      <Flameshot user={user} open={flameshotOpen} setOpen={setFlameshotOpen} />
      <ClearStorage open={clrStorOpen} setOpen={setClrStorOpen} />
    </>
  );
}
