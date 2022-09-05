import { OPCUAClient, DataValue, AttributeIds, TimestampsToReturn, ClientSubscription } from 'node-opcua-client';
import * as dotenv from 'dotenv'
import { io, Socket } from "socket.io-client"
import { OpcUaDevice } from './device';
dotenv.config();

let devices: OpcUaDevice[] = []
let opcUaClients = new Map<string, OPCUAClient>();
let socket: Socket;
async function main() {
    try {
        socket = io(process.env.CENTRAL_WS_URI as string, {
            reconnectionDelayMax: 10000,
            query: {
                "apiKey": process.env.CENTRAL_API_KEY
            }
        });

        socket.io.on("error", (error) => {
            console.error(error);
        });

        socket.on("connect", () => {
            console.log("Successfully connected to API WebSocket")
        })

        socket.on("load-configs", (response) => {
            devices = JSON.parse(response);
            clearClients().then(() => {
                loadDevices();
            });
        })
        
    } catch (err) {
        console.log('Error: ', err)
    }
}

async function clearClients() {
    for (let [, client] of opcUaClients) {
        client.disconnect();
    }
}

async function loadDevices() {
    for (let device of devices) {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            connectionStrategy: {
                maxRetry: 2,
                initialDelay: 2000,
                maxDelay: 10 * 1000
            }
        });

        client.on('backoff', () => console.log('retrying connection to opc server'));

        await client.connect(device.address);
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

        for (let sensor of device.sensors) {
            monitorNodeChange(subscription, sensor.nodeId, sensor.id)
        }

        opcUaClients.set(device.id, client);
    }
}

async function monitorNodeChange(sub: ClientSubscription, nodeId: string, sensorId: string) {
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
        socket.emit('value-read', { sensorId: sensorId, value: dataValue.value.value, readAt: dataValue.sourceTimestamp })
    });
}

main();