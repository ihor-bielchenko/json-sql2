# json-sql2
## Lightweight utility for converting structured objects into SQL-formatted strings.

The core idea is to rapidly transform specially structured objects into complete and secure SQL queries of any type or complexity. The complexity of the resulting query depends entirely on the structure of the input object. Can be useful for converting network request payloads into SQL queries.

# Quick Start
## Install
```shell
npm install json-sql2
```

## Basic Usage
```javascript
import { 
	StringToSqlBuilder,
	MetadataInterface, 
} from 'json-sql2';

// Create builder with database schema.
const builder = new StringToSqlBuilder(metadata as MetadataInterface);

// Get SQL string for select data.
const rowsSqlStr = builder.find({
	relations: {
		order: true,
	},
	select: {
		id: true,
		fullname: true,
		createdAt: true,
	},
	where: {
		fullname: `john smith`,
		order: {
			price: `$MoreThan(100)`,
			product: `$Not($Like('%book%'))`,
			status: 'Done',
		},
	},
	orders: {
		createdAt: true,
	},
	skip: 0,
	take: 20,
}).toString();

// Get SQL string for counting data.
const countSqlStr = builder.count({
	relations: {
		order: true,
	},
	where: {
		fullname: `john smith`,
		order: {
			price: `$MoreThan(100)`,
			product: `$Not($Like('%book%'))`,
			status: 'Done',
		},
	},
}).toString();
```

## Metadata properties

## API

## Examples