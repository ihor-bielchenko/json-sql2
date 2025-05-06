import { 
	isObjFilled,
	isArrFilled,
	isStrOrderType,
	isStrFilled, 
	isStrBool,
	isStr,
	isBool,
	isNum,
	isExists,
} from 'full-utils';
import {
	MetadataInterface,
	RelationMetadataInterface,
	QueryInterface,
	QueryParsedInterface,
	RelationQueryInterface,
	SelectQueryInterface,
	OrderQueryInterface,
	GroupQueryInterface,
} from './types';

export class StringToSqlBuilder {
	private readonly _parsed: QueryParsedInterface = { baseSelectPrepared: new Set() };
	private readonly _defaultLimit: number = Number(process.env.STR_TO_SQL_BUILDER_LIMIT ?? 20);
	private _type: string = ``;

	private _createJoins(metadata: RelationMetadataInterface, relations: RelationQueryInterface): string {
		let key = ``,
			output = [];

		for (key in relations) {
			if (relations[key] && metadata[key]) {
				const condition = metadata[key].type === `one-to-many`
					? `${metadata[key].tableName}.${metadata[key].referencedColumn} = ${metadata[key].referencedTableName}.${metadata[key].primaryColumn}`
					: `${metadata[key].referencedTableName}.${metadata[key].referencedColumn} = ${metadata[key].tableName}.${metadata[key].primaryColumn}`

				output.push(`LEFT JOIN ${metadata[key].tableName} ON ${condition}`);
			}
			if (metadata[key]
				&& isObjFilled(metadata[key].relations)
				&& isObjFilled(relations[key])) {
				output.push(this._createJoins({ ...metadata[key].relations }, { ...Object(relations[key]) }));
			}
		}
		return output.join(`\n`);
	}

	private _createSelectLoop(selectQuery: SelectQueryInterface, relationsQuery: RelationQueryInterface = {}, metadata?: MetadataInterface): Set<any> {
		let key = ``;

		if (!metadata) {
			metadata = this._metadata;
		}
		for (key in selectQuery) {
			if (!selectQuery[key]) {
				continue;
			}
			if (relationsQuery[key] && isObjFilled(metadata.relations[key])) {
				const newRelationsQuery = isObjFilled(relationsQuery[key]) 
					? relationsQuery[key] 
					: {};

				if (selectQuery[key] === true) {
					const newSelectQuery = {};

					metadata
						.relations[key]
						.columns
						.forEach((item) => {
							newSelectQuery[item.name] = true;
						});
					this._createSelectLoop(newSelectQuery, newRelationsQuery as RelationQueryInterface, metadata.relations[key]);
				}
				else if (isObjFilled(selectQuery[key])) {
					this._createSelectLoop(selectQuery[key] as SelectQueryInterface, newRelationsQuery as RelationQueryInterface, metadata.relations[key]);
				}
			}
			else {
				const columnName = `${metadata.tableName}_____${key}`;

				if (metadata.columns.find((item) => item.name === key) || relationsQuery[key] === true) {
					this._parsed.baseSelectPrepared.add(columnName);
				}
			}
		}
		for (key in relationsQuery) {
			if (!selectQuery[key] && relationsQuery[key] && isObjFilled(metadata.relations[key])) {
				const newRelationsQuery = isObjFilled(relationsQuery[key]) 
					? relationsQuery[key] 
					: {};
				const newSelectQuery = {};

				metadata
					.relations[key]
					.columns
					.forEach((item) => {
						newSelectQuery[item.name] = true;
					});
				this._createSelectLoop(newSelectQuery, newRelationsQuery as RelationQueryInterface, metadata.relations[key]);
			}
		}
		return this._parsed.baseSelectPrepared;
	}

	private _createSelect(selectQuery: SelectQueryInterface, relationsQuery: RelationQueryInterface = {}, metadata?: MetadataInterface): string {
		const prepared = this._createSelectLoop(selectQuery, relationsQuery, metadata);

		return Array
			.from(prepared)
			.map((item) => {
				const itemSplit = item.split(`_____`);

				return `\t${itemSplit[0]}.${itemSplit[1]} AS ${item}`;
			})
			.join(`,\n`);
	}

	private _createOrders(orders: OrderQueryInterface, tableName: string = ``): string {
		let key = ``,
			output = new Set();

		if (!tableName) {
			tableName = this._metadata.tableName;
		}
		for (key in orders) {
			if (isObjFilled(orders[key])) {
				output.add(this._createOrders({ ...Object(orders[key]) }, key));
			}
			else if (isStrOrderType(orders[key])) {
				output.add(`${tableName}.${key} ${orders[key]}`);
			}
		}
		return Array.from(output).join(`, `);
	}

	private _createGroups(groups: GroupQueryInterface, tableName: string = ``): string {
		let key = ``,
			output = new Set();

		if (!tableName) {
			tableName = this._metadata.tableName;
		}
		for (key in groups) {
			if (isObjFilled(groups[key])) {
				output.add(this._createGroups({ ...Object(groups[key]) }, key));
			}
			else if (groups[key] === true) {
				output.add(`${tableName}.${key}`);
			}
		}
		return Array.from(output).join(`, `);
	}

	private _createWhere(query): string {
		if (isArrFilled(query)) {
			let i = 0,
				parsed = [];

			while (i < query.length) {
				parsed.push(this._createWhereArrItem(query[i]));
				i++;
			}
			return parsed.join(` OR `);
		}
		let column = ``,
			output = [];

		for (column in query) {
			const parsed = this._createWhereItem(column, query[column]);

			if (isExists(parsed)) {
				output.push(parsed);
			}
		}
		return output.join(` AND `);
	}

	private _createWhereItem(column: string, value): string {
		if (!column.includes(`.`)) {
			column = `${this._metadata.tableName}.${column}`;
		}
		switch (true) {
			case isStrFilled(value):
				return this._createWhereItemOperator(column, this.parseOperator(value));

			case isStr(value):
				return `(${column} = '')`;

			case isStrBool(value):
			case isBool(value):
			case isNum(value):
				return `(${column} = ${value})`;

			case isObjFilled(value):
				const processed = new Set();

				for (let deepColumn in value) {
					processed.add(this._createWhereItem(`${column.split(`.`).slice(-1)}.${deepColumn}`, value[deepColumn]));
				}
				return Array.from(processed).join(` AND `);
		}
		return ``;
	}

	private _createWhereItemOperator(column: string, data: string): string {
		const dataProcessed = data.trim();
		const dataSplitByOperatorParametersStart = dataProcessed.split(`(`);
		const operatorName = dataSplitByOperatorParametersStart[0];

		if (!(operatorName
			&& dataSplitByOperatorParametersStart.length > 1
			&& dataProcessed[dataProcessed.length - 1] === `)`)) {
			return `(${column} = '${dataProcessed}')`;
		}
		const operatorParametersStr = dataSplitByOperatorParametersStart
			.slice(1)
			.join(`(`)
			.slice(0, -1);
		const operatorParameters = this.parseJsonAndTrimQuotes(operatorParametersStr);

		if (!this._parsed.baseGroups) {
			switch (operatorName) {
				case `$Max`:
					return `(${column} = (SELECT MAX(${column}) FROM ${this._metadata.tableName}))`;

				case `$Min`:
					return `(${column} = (SELECT MIN(${column}) FROM ${this._metadata.tableName}))`;

				case `$Sum`:
					return `(${column} = (SELECT SUM(${column}) FROM ${this._metadata.tableName}))`;

				case `$Avg`:
					return `(${column} = (SELECT AVG(${column}) FROM ${this._metadata.tableName}))`;

				case `$Count`:
					return `(${column} = (SELECT COUNT(${column}) FROM ${this._metadata.tableName}))`;

				case `$Total`:
					return `(${column} = (SELECT COUNT(*) FROM ${this._metadata.tableName}))`;
			}
		}
		switch (operatorName) {
			case `$Like`:
			case `$ILike`:
				return `(LOWER(${column}) LIKE '${operatorParameters}')`;

			case `$LessThan`:
				return `(${column} < '${operatorParameters}')`;

			case `$LessThanOrEqual`:
				return `(${column} <= '${operatorParameters}')`;

			case `$MoreThan`:
				return `(${column} > '${operatorParameters}')`;

			case `$MoreThanOrEqual`:
				return `(${column} >= '${operatorParameters}')`;

			case `$IsNull`:
				return `(${column} = '')`;

			case `$Between`:
				const startValue = isNum(operatorParameters[0])
					? operatorParameters[0]
					: `'${operatorParameters[0]}'`;
				const endValue = isNum(operatorParameters[1])
					? operatorParameters[1]
					: `'${operatorParameters[1]}'`;

				return `((${column} >= ${startValue}) AND (${column} <= ${endValue}))`;

			case `$In`:
				return `(${operatorParameters.map((item) => `(${column} = '${item}')`).join(` OR `)})`;

			case `$Any`:
				return `(ANY(ARRAY[${operatorParameters.map((item) => `(${column} = '${item}')`).join(` OR `).join(',')}]))`;

			case `$Not`:
				if (operatorParametersStr[operatorParametersStr.length - 1] === `)`) {
					switch (0) {
						case operatorParametersStr.indexOf(`$In(`):
							return `(${column} NOT IN (${this.parseJsonAndTrimQuotes(operatorParametersStr.replace(`$In(`, ``).slice(0, -1)).map((item) => `'${item}'`)}))`;

						case operatorParametersStr.indexOf(`$Like(`):
							return `(${column} NOT LIKE '${this.parseJsonAndTrimQuotes(operatorParametersStr.replace(`$Like(`, ``).slice(0, -1))}')`;

						case operatorParametersStr.indexOf(`$ILike(`):
							return `(${column} NOT LIKE '${this.parseJsonAndTrimQuotes(operatorParametersStr.replace(`$ILike(`, ``).slice(0, -1))}')`;

						case operatorParametersStr.indexOf(`$IsNull(`):
							return `(${column} IS NOT NULL)`;

						case operatorParametersStr.indexOf(`$LessThan(`):
							return `(${column} NOT < (${this.parseJsonAndTrimQuotes(operatorParametersStr.replace(`$LessThan(`, ``).slice(0, -1))}))`;

						case operatorParametersStr.indexOf(`$LessThanOrEqual(`):
							return `(${column} NOT <= (${this.parseJsonAndTrimQuotes(operatorParametersStr.replace(`$LessThanOrEqual(`, ``).slice(0, -1))}))`;

						case operatorParametersStr.indexOf(`$MoreThan(`):
							return `(${column} NOT > (${this.parseJsonAndTrimQuotes(operatorParametersStr.replace(`$MoreThan(`, ``).slice(0, -1))}))`;

						case operatorParametersStr.indexOf(`$MoreThanOrEqual(`):
							return `(${column} NOT >= (${this.parseJsonAndTrimQuotes(operatorParametersStr.replace(`$MoreThanOrEqual(`, ``).slice(0, -1))}))`;
					}
				}
				return `(${column} != '${operatorParameters}')`;
		}
		if (dataProcessed[0] === `\\`) {
			return `(${column} = '${dataProcessed.slice(1)}')`;
		}
		return `(${column} = '${dataProcessed}')`;
	}

	private _createWhereArrItem(queryItem): string {
		if (isArrFilled(queryItem) || isObjFilled(queryItem)) {
			return this._createWhere(queryItem);
		}
		return String(queryItem ?? ``);
	}

	private _createHaving(groups: GroupQueryInterface): string {
		return ``;
	}

	constructor(
		private readonly _metadata: MetadataInterface,
		private readonly _query: QueryInterface,
	) {
	}

	setType(type: string): StringToSqlBuilder {
		this._type = type;
		return this;
	}

	find(): StringToSqlBuilder {
		return this
			.setType(`find`)
			.relations()
			.select()
			.orders()
			.groups()
			.limits()
			.where()
			.having();
	}

	count(): StringToSqlBuilder {
		return this
			.setType(`count`)
			.relations()
			.select()
			.orders()
			.groups()
			.limits()
			.where()
			.having();
	}

	toString(): string {
		switch (this._type) {
			case `find`:
				return `SELECT\n${this._parsed.baseSelect ?? ``}\nFROM ${this._metadata.tableName}\n${this._parsed.baseJoins ?? ``}${this._parsed.baseWhere ? `\nWHERE\n\t${this._parsed.baseWhere}` : ``}${this._parsed.baseGroups ? `\nGROUP BY\n\t${this._parsed.baseGroups}` : ``}${this._parsed.baseHaving ? `\nHAVING\n\t${this._parsed.baseHaving}` : ``}${this._parsed.baseOrders ? `\nORDER BY\n\t${this._parsed.baseOrders}` : ``}\n${this._parsed.baseLimits ? this._parsed.baseLimits : ``};`;

			case `count`:
				if (this._parsed.baseGroups) {
					return `SELECT\nCOUNT(*) AS total\nFROM (\n\tSELECT\n${this._parsed.baseSelect ?? ``}\nFROM ${this._metadata.tableName}\n${this._parsed.baseJoins ?? ``}${this._parsed.baseWhere ? `\nWHERE\n\t${this._parsed.baseWhere}` : ``}${this._parsed.baseGroups ? `\nGROUP BY\n\t${this._parsed.baseGroups}` : ``}${this._parsed.baseHaving ? `\nHAVING\n\t${this._parsed.baseHaving}` : ``}) grouped;`;
				}
				return `SELECT\nCOUNT(DISTINCT ${this._metadata.tableName}.id) AS total\nFROM ${this._metadata.tableName}\n${this._parsed.baseJoins ?? ``}${this._parsed.baseWhere ? `\nWHERE\n\t${this._parsed.baseWhere}` : ``};`;
		}
		return ``;
	}

	relations(): StringToSqlBuilder {
		if (isObjFilled(this._metadata.relations)
			&& isObjFilled(this._query.relations)) {
			this._parsed[`baseJoins`] = this._createJoins(this._metadata.relations, this._query.relations);
		}
		return this;
	}

	select(): StringToSqlBuilder {
		if (isArrFilled(this._metadata.columns)
			&& isObjFilled(this._query.select)) {
			this._parsed[`baseSelect`] = this._createSelect(this._query.select, this._query.relations);
		}
		return this;
	}

	orders(): StringToSqlBuilder {
		if (isObjFilled(this._query.orders)) {
			this._parsed[`baseOrders`] = this._createOrders(this._query.orders);
		}
		return this;
	}

	groups(): StringToSqlBuilder {
		if (isObjFilled(this._query.groups)) {
			this._parsed[`baseGroups`] = this._createGroups(this._query.groups);
		}
		return this;
	}

	limits(): StringToSqlBuilder {
		const prepareSkip = this._query.skip ?? this._query.offset;
		const take = this._query.take ?? this._query.limit ?? this._defaultLimit;
		const page = (this._query.page >= 1)
			? (this._query.page * take)
			: 0;
		const skip = (page > 0)
			? page
			: ((prepareSkip >= 0)
				? prepareSkip
				: 0);

		if (skip >= 0 && take >= 1) {
			this._parsed[`baseLimits`] = `LIMIT ${skip}, ${take}`;
		}
		return this;
	}

	where(): StringToSqlBuilder {
		const result = this._createWhere(this._query.where);

		if (result) {
			this._parsed[`baseWhere`] = result;
		}
		return this;
	}

	having(): StringToSqlBuilder {
		const result = this._createHaving(this._query.groups);

		if (result) {
			this._parsed[`baseHaving`] = result;
		}
		return this;
	}

	parseJsonAndTrimQuotes(data) {
		if (isStr(data)) {
			try {
				return JSON.parse(data);
			}
			catch (err) {
			}
			if ((data[0] === `'`
					&& data[data.length - 1] === `'`)
				|| (data[0] === `"`
					&& data[data.length - 1] === `"`)
				|| (data[0] === '`'
					&& data[data.length - 1] === '`')) {
				const prepare = data.slice(1).slice(0, data.length - 2);

				try {
					return JSON.parse(`[${prepare}]`);
				}
				catch (err) {
				}
				try {
					return JSON.parse(`{${prepare}}`);
				}
				catch (err) {
				}
				return data.slice(1).slice(0, data.length - 2);
			}
			return data;
		}
	}

	parseOperator(value: string): string {
		const valueTmplateFirstIndex = value.indexOf('${');
		const valueTmplateSecondIndex = value.indexOf('}');

		if (valueTmplateFirstIndex >= 0
			&& valueTmplateSecondIndex >= 0
			&& valueTmplateSecondIndex > valueTmplateFirstIndex) {
			const valueTmplate = value.slice(valueTmplateFirstIndex, valueTmplateSecondIndex + 1);

			return this.parseOperator(value.split(value.slice(valueTmplateFirstIndex, valueTmplateSecondIndex + 1)).join(''));
		}
		return value;
	}
}
