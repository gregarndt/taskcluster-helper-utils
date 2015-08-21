import slugid from 'slugid';

const NUMBER_OF_TASKS = 500;
const WORKER_TYPE = 'garndt-test';
const MAX_DELAY = 15;

let graphId = slugid.v4();

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

for (let i = 0; i < NUMBER_OF_TASKS; i++) {
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
        command: ['/bin/bash', '-c', `ls -lah && sleep ${delay}`],
        image: 'ubuntu:14.04',
        maxRunTime: 90
      }
    }
  });
}

console.log(JSON.stringify(graph, null, 4));
