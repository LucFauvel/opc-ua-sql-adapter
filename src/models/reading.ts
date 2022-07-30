import { Model } from "sequelize";

export class Reading extends Model {
    declare SensorId: string;
    declare Value: number;
}