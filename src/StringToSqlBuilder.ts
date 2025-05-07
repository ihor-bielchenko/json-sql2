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
	toBool,
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
	private _query: QueryInterface;
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
		return Array.from(output).filter((item) => !!item).join(`, `);
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
		return Array.from(output).filter((item) => !!item).join(`, `);
	}

	private _createWhere(query, forHaving: boolean = false): string {
		if (isArrFilled(query)) {
			let i = 0,
				parsed = [];

			while (i < query.length) {
				parsed.push(this._createWhereArrItem(query[i], forHaving));
				i++;
			}
			return parsed.filter((item) => !!item).join(` OR `);
		}
		let column = ``,
			output = [];

		for (column in query) {
			const parsed = this._createWhereItem(column, query[column], forHaving);

			if (isExists(parsed)) {
				output.push(parsed);
			}
		}
		return output.filter((item) => !!item).join(` AND `);
	}

	private _createWhereItem(column: string, value, forHaving: boolean = false): string {
		if (!column.includes(`.`)) {
			column = `${this._metadata.tableName}.${column}`;
		}
		switch (true) {
			case isStrFilled(value):
				return this._createWhereItemOperator(column, this.parseOperator(value), forHaving);

			case (isStr(value) && !forHaving):
				return `(${column} = '')`;

			case (isStrBool(value) && !forHaving):
			case (isBool(value) && !forHaving):
			case (isNum(value) && !forHaving):
				return `(${column} = ${value})`;

			case isObjFilled(value):
				const processed = new Set();

				for (let deepColumn in value) {
					processed.add(this._createWhereItem(`${column.split(`.`).slice(-1)}.${deepColumn}`, value[deepColumn], forHaving));
				}
				return Array.from(processed)
					.filter((item) => !!item)
					.join(` AND `);

			case isArrFilled(value):
				return Array.from(value)
					.map((item) => this._createWhereItem(column, item, forHaving))
					.filter((item) => !!item)
					.join(` OR `);
		}
		return ``;
	}

	private _createWhereItemOperator(column: string, data: string, forHaving: boolean = false): string {
		const dataProcessed = data.trim();

		if (dataProcessed[0] === `\\`) {
			return forHaving
				? ``
				: `(${column} = '${dataProcessed.slice(1)}')`;
		}
		const dataSplitByOperatorParametersStart = dataProcessed.split(`(`);
		const operatorName = dataSplitByOperatorParametersStart[0];

		if (!(operatorName
			&& dataSplitByOperatorParametersStart.length > 1
			&& dataProcessed[dataProcessed.length - 1] === `)`)) {
			return forHaving
				? ``
				: `(${column} = '${dataProcessed}')`;
		}
		const operatorParametersStr = dataSplitByOperatorParametersStart
			.slice(1)
			.join(`(`)
			.slice(0, -1);
		const operatorParameters = this.parseJsonAndTrimQuotes(operatorParametersStr);

		if (forHaving) {
			return this._createWhereOperatorByHaving(operatorName, column, operatorParameters, forHaving);
		}
		else if (!this._parsed.baseGroups) {
			const result = this._createWhereOperatorByGroups(operatorName, column, this._metadata.tableName);

			if (result) {
				return result;
			}			
		}
		return this._createWhereOperator(operatorName, column, operatorParameters, forHaving);
	}

	private _createWhereArrItem(queryItem, forHaving: boolean = false): string {
		if (isArrFilled(queryItem) || isObjFilled(queryItem)) {
			return this._createWhere(queryItem, forHaving);
		}
		return String(queryItem ?? ``);
	}

	private _createWhereOperator(operatorName: string, column: string, data, forHaving: boolean = false): string {
		const dataStr = String(data ?? ``);

		switch (operatorName) {
			case `$Max`:
			case `$Min`:
			case `$Sum`:
			case `$Avg`:
			case `$Count`:
			case `$Total`:
					return ``;

			case '$And':
				return this._parseOperatorStr(data)
					.map((item) => this._createWhereItem(column, item, forHaving))
					.filter((item) => !!item)
					.join(` AND `);

			case `$Like`:
			case `$ILike`:
				return `(LOWER(${column}) LIKE '${data}')`;

			case `$LessThan`:
				return `(${column} < '${data}')`;

			case `$LessThanOrEqual`:
				return `(${column} <= '${data}')`;

			case `$MoreThan`:
				return `(${column} > '${data}')`;

			case `$MoreThanOrEqual`:
				return `(${column} >= '${data}')`;

			case `$IsNull`:
				return `(${column} = '')`;

			case `$Between`:
				const startValue = isNum(data[0])
					? data[0]
					: `'${data[0]}'`;
				const endValue = isNum(data[1])
					? data[1]
					: `'${data[1]}'`;

				return `((${column} >= ${startValue}) AND (${column} <= ${endValue}))`;

			case `$In`:
				return `(${data
					.map((item) => `(${column} = '${item}')`)
					.filter((item) => !!item)
					.join(` OR `)})`;

			case `$Any`:
				return `(ANY(ARRAY[${data
					.map((item) => `(${column} = '${item}')`)
					.filter((item) => !!item)
					.join(` OR `)
					.join(',')}]))`;

			case `$Not`:
				if (dataStr[dataStr.length - 1] === `)`) {
					switch (0) {
						case dataStr.indexOf(`$In(`):
							return `(${column} NOT IN (${this.parseJsonAndTrimQuotes(dataStr.replace(`$In(`, ``).slice(0, -1)).map((item) => `'${item}'`)}))`;

						case dataStr.indexOf(`$Like(`):
							return `(${column} NOT LIKE '${this.parseJsonAndTrimQuotes(dataStr.replace(`$Like(`, ``).slice(0, -1))}')`;

						case dataStr.indexOf(`$ILike(`):
							return `(${column} NOT LIKE '${this.parseJsonAndTrimQuotes(dataStr.replace(`$ILike(`, ``).slice(0, -1))}')`;

						case dataStr.indexOf(`$IsNull(`):
							return `(${column} IS NOT NULL)`;

						case dataStr.indexOf(`$LessThan(`):
							return `(${column} NOT < (${this.parseJsonAndTrimQuotes(dataStr.replace(`$LessThan(`, ``).slice(0, -1))}))`;

						case dataStr.indexOf(`$LessThanOrEqual(`):
							return `(${column} NOT <= (${this.parseJsonAndTrimQuotes(dataStr.replace(`$LessThanOrEqual(`, ``).slice(0, -1))}))`;

						case dataStr.indexOf(`$MoreThan(`):
							return `(${column} NOT > (${this.parseJsonAndTrimQuotes(dataStr.replace(`$MoreThan(`, ``).slice(0, -1))}))`;

						case dataStr.indexOf(`$MoreThanOrEqual(`):
							return `(${column} NOT >= (${this.parseJsonAndTrimQuotes(dataStr.replace(`$MoreThanOrEqual(`, ``).slice(0, -1))}))`;
					}
				}
				return forHaving
					? ``
					: `(${column} != '${data}')`;
		}
		return forHaving
			? ``
			: `(${column} = '${dataStr}')`;
	}

	private _createWhereOperatorByGroups(operatorName: string, column: string, tableName: string): string {
		switch (operatorName) {
			case `$Max`:
				return `(${column} = (SELECT MAX(${column}) FROM ${tableName}))`;

			case `$Min`:
				return `(${column} = (SELECT MIN(${column}) FROM ${tableName}))`;

			case `$Sum`:
				return `(${column} = (SELECT SUM(${column}) FROM ${tableName}))`;

			case `$Avg`:
				return `(${column} = (SELECT AVG(${column}) FROM ${tableName}))`;

			case `$Count`:
				return `(${column} = (SELECT COUNT(${column}) FROM ${tableName}))`;

			case `$Total`:
				return `(${column} = (SELECT COUNT(*) FROM ${tableName}))`;
		}
		return ``;
	}

	private _createWhereOperatorByHaving(operatorName: string, column: string, data, forHaving: boolean = false): string {
		switch (operatorName) {
			case `$Max`:
				return this._createWhereItem(`MAX(${column})`, data);

			case `$Min`:
				return this._createWhereItem(`MIN(${column})`, data);

			case `$Sum`:
				return this._createWhereItem(`SUM${column})`, data);

			case `$Avg`:
				return this._createWhereItem(`AVG(${column})`, data);

			case `$Count`:
				return this._createWhereItem(`COUNT(${column})`, data);
		}
		return this._createWhereOperator(operatorName, column, data, forHaving);
	}

	private _parseOperatorStr(input: string): Array<any> {
		if (input.startsWith(`[`) && input.endsWith(`]`)) {
			input = input.slice(1, -1);
		}
		const result = [];
		let buffer = ``,
			i = 0,
			depth = 0,
			inQuote = false,
			quoteChar = null;

		while (i < input.length) {
			const char = input[i];

			if (inQuote) {
				buffer += char;
				
				if (char === quoteChar && input[i - 1] !== `\\`) {
					inQuote = false;
				}
			} 
			else if (char === `'` || char === `"`) {
				inQuote = true;
				quoteChar = char;
				buffer += char;
			} 
			else if (char === `(`) {
				depth++;
				buffer += char;
			} 
			else if (char === `)`) {
				depth--;
				buffer += char;
			} 
			else if (char === `,` && depth === 0 && !inQuote) {
				result.push(buffer.trim());
				buffer = ``;
			} 
			else {
				buffer += char;
			}
			i++;
		}
		if (buffer.trim()) {
			result.push(buffer.trim());
		}
		return result.map(item => {
			if (item.startsWith(`$`) && item.includes(`(`) && item.endsWith(`)`)) {
				return item;
			}
			if (isStrBool(item)) {
				return toBool(item);
			}
			if (item === `null`) {
				return null;
			}
			if (isNum(item)) {
				return Number(item);
			}
			if ((item.startsWith(`'`) && item.endsWith(`'`)) 
				|| (item.startsWith(`"`) && item.endsWith(`"`))) {
				return item.slice(1, -1);
			}
			return item;
		});
	}

	constructor(
		private readonly _metadata: MetadataInterface,
	) {
	}

	setType(type: string): StringToSqlBuilder {
		this._type = type;
		return this;
	}

	find(query: QueryInterface = {}): StringToSqlBuilder {
		this._query = query;

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

	count(query: QueryInterface = {}): StringToSqlBuilder {
		this._query = query;

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
				return `SELECT${this._parsed.baseSelect ? `\n${this._parsed.baseSelect}` : ` *`}\nFROM ${this._metadata.tableName}${this._parsed.baseJoins ? `\n${this._parsed.baseJoins}` : ``}${this._parsed.baseWhere ? `\nWHERE\n\t${this._parsed.baseWhere}` : ``}${this._parsed.baseGroups ? `\nGROUP BY\n\t${this._parsed.baseGroups}` : ``}${this._parsed.baseHaving ? `\nHAVING\n\t${this._parsed.baseHaving}` : ``}${this._parsed.baseOrders ? `\nORDER BY\n\t${this._parsed.baseOrders}` : ``}\n${this._parsed.baseLimits ? this._parsed.baseLimits : ``};`;

			case `count`:
				if (this._parsed.baseGroups) {
					return `SELECT\nCOUNT(*) AS total\nFROM (\n\tSELECT${this._parsed.baseSelect ? `\n${this._parsed.baseSelect}` : ` *`}\nFROM ${this._metadata.tableName}${this._parsed.baseJoins ? `\n${this._parsed.baseJoins}` : ``}${this._parsed.baseWhere ? `\nWHERE\n\t${this._parsed.baseWhere}` : ``}${this._parsed.baseGroups ? `\nGROUP BY\n\t${this._parsed.baseGroups}` : ``}${this._parsed.baseHaving ? `\nHAVING\n\t${this._parsed.baseHaving}` : ``}) grouped;`;
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
		if (this._parsed.baseGroups && this._parsed.baseWhere) {
			const result = this._createWhere(this._query.where, true);

			if (result) {
				this._parsed[`baseHaving`] = result;
			}
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
