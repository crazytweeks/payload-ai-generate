import buildConfigWithMemoryDB from '@payload-config';
import { getPayload } from 'payload';

const Hipage = async () => {
  const payload = await getPayload({
    config: buildConfigWithMemoryDB,
  });

  console.log('Payload ai instance in payload:', Boolean(payload.ai));

  const ai = await payload.ai?.generateText({
    prompt: 'Write a haiku about Payload CMS',
    provider: 'google',
    system: 'You are a helpful assistant that writes haikus.',
  });

  return (
    <div>
      <h1>Hi there!</h1>
      <p>This page is rendered using the AI plugin service attached to Payload.</p>
      <p>Check the console for the AI response.</p>

      <pre>{JSON.stringify(ai, null, 2)}</pre>
    </div>
  );
};

export default Hipage;
