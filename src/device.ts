import { Sensor } from "./sensor";

export class OpcUaDevice {
    declare id: string;
    declare name: string;
    declare address: string;
    declare machineId: string;
    declare sensors: Sensor[]
}