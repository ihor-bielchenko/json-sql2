
export interface QueryParsedInterface {
	baseJoins?: string;
	baseSelect?: string;
	baseSelectPrepared: Set<any>;
	baseOrders?: string;
	baseGroups?: string;
	baseLimits?: string;
	baseWhere?: string;
	baseHaving?: string;
}

export interface RelationQueryInterface {
	[name: string]: boolean | RelationQueryInterface;
}

export interface SelectQueryInterface {
	[name: string]: boolean | SelectQueryInterface;
}

export interface GroupQueryInterface {
	[name: string]: boolean | GroupQueryInterface;
}

export interface OrderQueryInterface {
	[name: string]: string | OrderQueryInterface;
}

export interface WhereQueryInterface {
	[name: string]: boolean | string | number | null | WhereQueryInterface | Array<boolean | string | number | null | WhereQueryInterface>;
}

export interface QueryInterface {
	relations?: RelationQueryInterface;
	select?: SelectQueryInterface;
	groups?: GroupQueryInterface;
	orders?: OrderQueryInterface;
	where?: WhereQueryInterface | Array<WhereQueryInterface>;
	offset?: number;
	skip?: number;
	take?: number;
	page?: number;
	limit?: number;
}

export interface RelationMetadataInterface {
	[name: string]: MetadataInterface;
}

export interface ColumnMetadataInterface {
	name: string;
}

export interface MetadataInterface {
	type?: string;
	tableName: string;
	referencedTableName?: string;
	referencedColumn?: string;
	primaryColumn?: string;
	relations?: RelationMetadataInterface;
	columns: Array<ColumnMetadataInterface>;
}
