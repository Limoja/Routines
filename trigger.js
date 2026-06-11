const { EventHubProducerClient } = require('@azure/event-hubs');
const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://limoja-cosmos.documents.azure.com:443/';
const COSMOS_KEY = process.env.COSMOS_KEY;
const EVENT_HUB_CONNECTION_STRING = process.env.EVENT_HUB_CONNECTION_STRING;

async function trigger(routinePath) {
  // routinePath format: "ai-instructor/team-po"
  const [project, routineName] = routinePath.split('/');
  if (!project || !routineName) {
    console.error('Usage: node trigger.js <project>/<routine-name>');
    console.error('Example: node trigger.js ai-instructor/team-po');
    process.exit(1);
  }

  const configPath = path.join(__dirname, project, 'configs', `${routineName}.json`);
  if (!fs.existsSync(configPath)) {
    console.error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const agentId = config.agentId;

  // Get Event Hub connection string from env or Cosmos
  let connStr = EVENT_HUB_CONNECTION_STRING;
  if (!connStr && COSMOS_KEY) {
    try {
      const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
      const db = client.database('Limoja');
      const container = db.container('agents');
      const { resource } = await container.item(agentId, agentId).read();
      if (resource?.resources?.eventHubConnectionString) {
        connStr = resource.resources.eventHubConnectionString;
      }
    } catch (e) {
      console.error(`Failed to get Event Hub connection from Cosmos: ${e.message}`);
      process.exit(1);
    }
  }

  if (!connStr) {
    console.error('No Event Hub connection string. Set EVENT_HUB_CONNECTION_STRING or COSMOS_KEY.');
    process.exit(1);
  }

  const hubName = `${agentId}-requests`;
  const producer = new EventHubProducerClient(connStr, hubName);

  const taskId = `routine-${routineName}-${Date.now()}`;
  const sessionId = `routine-${routineName}`;

  const event = {
    type: 'routine',
    agentId,
    taskId,
    jid: `routine-${routineName}@internal`,
    chatId: `routine-${routineName}@internal`,
    sessionId,
    parentSessionId: null,
    prompt: '',
    mediaType: 'text',
    mediaUrl: null,
    platform: 'routine',
    timestamp: Date.now(),
    routine: {
      name: routineName,
      role: config.role,
      project,
      specRepo: config.specRepo,
      specBranch: config.specBranch || 'main',
      routinesRepo: 'https://github.com/Limoja/Routines.git',
      specPath: `${project}/specs/${config.role}.md`,
      inputHandoff: config.inputHandoff ? `${project}/${config.inputHandoff}` : null,
      outputHandoff: config.outputHandoff ? `${project}/${config.outputHandoff}` : null,
      workBranch: config.workBranch,
      addDir: config.addDir || __dirname,
      maxDurationMinutes: config.maxDurationMinutes || 45,
      devApiUrl: config.devApiUrl || '',
      devWebUrl: config.devWebUrl || '',
      prodApiUrl: config.prodApiUrl || '',
    },
  };

  await producer.sendBatch([{ body: event }]);
  console.log(`Triggered: ${routineName} (${config.role}) → ${agentId} [${taskId}]`);
  await producer.close();
}

const name = process.argv[2];
if (!name) {
  console.error('Usage: node trigger.js <project>/<routine-name>');
  process.exit(1);
}

trigger(name).catch(e => { console.error(e.message); process.exit(1); });
