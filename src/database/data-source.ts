import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source.options';

export const AppDataSource = new DataSource(buildDataSourceOptions());
