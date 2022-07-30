import { OPCUAClient, DataValue, AttributeIds, TimestampsToReturn, ClientSubscription } from 'node-opcua-client';
import { Reading } from './models/reading';
import { Subject } from 'rxjs';
import { Sequelize, DataTypes } from 'sequelize';
const endpointUrl = 'opc.tcp://172.20.0.10:4840';
const analogOneNodeId = 'ns=4;i=3';
const analogTwoNodeId = 'ns=4;i=4';
const tempNodeId = 'ns=4;i=5';
const tempSubject$: Subject<number> = new Subject();
const analogOneSubject$: Subject<number> = new Subject();
const analogTwoSubject$: Subject<number> = new Subject();
const sequelize = new Sequelize('ScalanceLPE9403Demo', 'sa', 'Masterkey!', {
    host: 'localhost',
    dialect: 'mssql',
    define: {
        timestamps: true,
        createdAt: 'readAt',
        updatedAt: false,
    }
});

async function main() {
    try {
        await sequelize.authenticate();

        const client = OPCUAClient.create({
            endpointMustExist: false,
            connectionStrategy: {
                maxRetry: 2,
                initialDelay: 2000,
                maxDelay: 10 * 1000
            }
        });

        Reading.init({
            SensorId: {
                type: DataTypes.INTEGER,
            },
            Value: {
                type: DataTypes.FLOAT,
            }
        }, { sequelize });
        Reading.removeAttribute('id');

        client.on('backoff', () => console.log('retrying connection to opc server'));

        await client.connect(endpointUrl);
        const session = await client.createSession();

        const subscription = await  session.createSubscription2({
            requestedPublishingInterval: 1000,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 20,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 10
        });

        subscription
            .on('started', () => console.log('subscription started - subscriptionId=', subscription.subscriptionId))
            .on('keepalive', () => console.log('keepalive'))
            .on('terminated', () => console.log('subscription terminated'));

        tempSubject$.subscribe(data => saveNodeData(5, data));
        analogOneSubject$.subscribe(data => saveNodeData(3, data));
        analogOneSubject$.subscribe(data => saveNodeData(4, data));

        await monitorNode(subscription, tempNodeId, tempSubject$);
        await monitorNode(subscription, analogOneNodeId, analogOneSubject$);
        await monitorNode(subscription, analogTwoNodeId, analogTwoSubject$);
        
    } catch (err) {
        console.log('Error: ', err)
    }
}

async function monitorNode(sub: ClientSubscription, nodeId: string, subject: Subject<number>) {
    const monitoredItem = await sub.monitor({
        nodeId,
        attributeId: AttributeIds.Value
    }, {
        samplingInterval: 100,
        discardOldest: true,
        queueSize: 0
    }, 
    TimestampsToReturn.Both);
    
    monitoredItem.on('changed', (dataValue: DataValue) => {
        subject.next(dataValue.value.value)
    });
}

async function saveNodeData(sensorId: number, value: number) {
    await Reading.create({
        Value: value,
        SensorId: sensorId
    });
}

main();