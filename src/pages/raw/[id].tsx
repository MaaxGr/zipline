import prisma from 'lib/prisma';
import { checkPassword } from 'lib/util';
import { GetServerSideProps } from 'next';
import { streamToString } from 'utils/streams';

export default function Code() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (process.env.ZIPLINE_DOCKER_BUILD) return { props: { code: '', id: '' } };

  const { default: datasource } = await import('lib/datasource');

  const data = await datasource.get(context.params.id as string);
  if (!data)
    return {
      notFound: true,
    };

  const file = await prisma.file.findFirst({
    where: {
      name: context.params.id as string,
    },
  });
  if (!file) return { notFound: true };

  if (file.password && !context.query.password)
    return {
      notFound: true,
    };

  if (file.password && context.query.password) {
    const valid = await checkPassword(context.query.password as string, file.password);
    if (!valid) return { notFound: true };
  }

  context.res.setHeader('Cache-Control', 'public, max-age=2628000, stale-while-revalidate=86400');

  await prisma.file.update({
    where: {
      id: file.id,
    },
    data: {
      views: {
        increment: 1,
      },
    },
  });

  context.res.setHeader('Content-Type', `${file.mimetype}; charset=utf-8`);
  context.res.write(await streamToString(data));
  context.res.end();

  return {
    props: {},
  };
};
