import taskcluster from 'taskcluster-client';
import request from 'superagent-promise';
import slugid from 'slugid';

const NUMBER_OF_TASKS = 1000;
const WORKER_TYPE = 'garndt-test';
const MAX_DELAY = 5;

let scheduler = new taskcluster.Scheduler();
let queue = new taskcluster.Queue();
let queueEvents = new taskcluster.QueueEvents();
let schedulerEvents = new taskcluster.SchedulerEvents();
let queueListener = new taskcluster.PulseListener({
  credentials: {
    username: process.env.PULSE_USERNAME,
    password: process.env.PULSE_PASSWORD
  }
});
let schedulerListener = new taskcluster.PulseListener({
  credentials: {
    username: process.env.PULSE_USERNAME,
    password: process.env.PULSE_PASSWORD
  }
});

async function sleep(duration) {
  return new Promise(accept => setTimeout(accept, duration));
}

function buildTaskGraph(numberOfTasks) {
  let graph = {
    tasks: [],
    scopes: ['*'],
    metadata: {
      name: 'garndt',
      description: 'Load testing docker-worker',
      owner: 'garndt@mozilla.com',
      source: 'http://blog.gregarndt.com'
   }
  }

  for (let i = 0; i < numberOfTasks; i++) {
    let taskId = slugid.v4();
    let created = new Date();
    let deadline = new Date();
    let delay = Math.floor(Math.random() * (MAX_DELAY - 1 + 1)) + 1;
    deadline.setHours(deadline.getHours() + 2);

    graph.tasks.push({
      taskId: taskId,
      task: {
        metadata: {
          name: `Test Task ${i}`,
          description: 'Load testing docker-worker',
          owner: 'garndt@mozilla.com',
          source: 'http://blog.gregarndt.com'
        },
        scopes: ['queue:define-task:aws-provisioner-v1/ami-test'],
        provisionerId: 'aws-provisioner-v1',
        workerType: WORKER_TYPE,
        schedulerId: 'task-graph-scheduler',
        created: created,
        deadline: deadline,
        payload: {
          command: ['/bin/bash', '-c', `sleep ${delay}`],
          image: 'ubuntu:14.04',
          maxRunTime: 90
        }
      }
    });
  }

  return graph;
}

async function processFailedRun(message) {
  let taskId = message.payload.status.taskId;
  let runId =  message.payload.runId;
  let inspectorUrl = `https:\/\/tools.taskcluster.net/task-inspector/#${taskId}/${runId}`;
  let artifactUrl = `https:\/\/queue.taskcluster.net/v1/task/${taskId}/runs/${runId}/artifacts/public/logs/live_backing.log`;
  let artifact = await request.get(artifactUrl).end();

  console.log(inspectorUrl);
  console.log(artifactUrl);

  if (artifact.text.includes('link not found')) {
    console.log('link not found');
  }

  if (artifact.text.includes('iptables')) {
    console.log('ip tables error found');
  }

  return;
}

async () => {
  let graph = buildTaskGraph(NUMBER_OF_TASKS);
  let graphId = slugid.v4();
  let tasks = 0;
  let taskStats = {
    completed: 0,
    failed: 0,
    exception: 0
  }

  console.log(`Creating taskgraph: ${graphId}`);

  queueListener.bind(queueEvents.taskException({taskGroupId: graphId}));
  queueListener.bind(queueEvents.taskFailed({taskGroupId: graphId}));
  queueListener.bind(queueEvents.taskCompleted({taskGroupId: graphId}));
  queueListener.on('message', async (message) => {
    tasks += 1;
    switch (message.payload.status.state) {
      case 'completed':
        console.log('completed');
        break;
      case 'failed':
        console.log('failed');
        await processFailedRun(message);
        break;
      case 'exception':
        console.log('exception');
        await processFailedRun(message);
        break;
    }

    taskStats[message.payload.status.state] += 1;
    tasks += 1
    if (tasks >= NUMBER_OF_TASKS) {
      console.log('finished');
      console.log(taskStats);
      process.exit();}

  });

  await queueListener.resume();

  await scheduler.createTaskGraph(graphId, graph);
}().catch((err) => { console.log(err.stack) });
