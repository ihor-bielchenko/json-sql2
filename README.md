# json-sql2
## Lightweight utility for converting structured objects into SQL-formatted strings.

The core idea is to rapidly transform specially structured objects into complete and secure SQL queries of any type or complexity. The complexity of the resulting query depends entirely on the structure of the input object.

# Quick Start
## Install
```shell
npm install json-sql2
```

## Basic Usage
```javascript
import { StringToSqlBuilder } from 'json-sql2';

const metadata: MetadataInterface = metadata_properties;

const builder = new StringToSqlBuilder(metadata);
const sqlRowsStr = builder.find({
	relations: {
		order: true,
	},
	select: {
		id: true,
		login: true,
		fullname: true,
		createdAt: true,
	},
	where: {
		login: `$Like('%manager%')`,
		order: {
			price: `$MoreThan(100)`,
			product: `$Not($Like('%book%'))`,
		},
	},
	orders: {
		createdAt: true,
	},
	skip: 0,
	take: 20,
}).toString();
const sqlTotalStr = builder.count({
	relations: {
		order: true,
	},
	where: {
		login: `$Like('%manager%')`,
		order: {
			price: `$MoreThan(100)`,
			product: `$Not($Like('%book%'))`,
		},
	},
}).toString();
```

## Metadata properties

## API

## Examples