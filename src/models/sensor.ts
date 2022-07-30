import { Model } from "sequelize"

export class Sensor extends Model {
    declare SensorID: string;
    declare Name: string;
    declare DataType: DataType;
    declare Value: number;
}

export enum DataType {
    Temperature,
    Analog,
}