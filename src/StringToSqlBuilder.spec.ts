import { StringToSqlBuilder } from '../src/StringToSqlBuilder';

const userMetadata = {
	tableName: `user`,
	relations: {
		order: {
			type: `one-to-many`,
			tableName: `order`,
			referencedTableName: `user`,
			referencedColumn: `userId`,
			primaryColumn: `id`,
			columns: [{
				name: `id`,
			}, {
				name: `product`,
			}, {
				name: `price`,
			}, {
				name: `status`,
			}, {
				name: `createdAt`,
			}],
		},
		role: {
			type: `many-to-one`,
			tableName: `role`,
			referencedTableName: `user`,
			referencedColumn: `roleId`,
			primaryColumn: `id`,
			columns: [{
				name: `id`,
			}, {
				name: `name`,
			}],
			relations: {
				roleAccesses: {
					type: `one-to-many`,
					tableName: `role_access`,
					referencedTableName: `role`,
					referencedColumn: `roleId`,
					primaryColumn: `id`,
					columns: [{
						name: `id`,
					}, {
						name: `roleId`,
					}, {
						name: `accessId`,
					}],
					relations: {
						access: {
							type: `many-to-one`,
							tableName: `access`,
							referencedTableName: `role_access`,
							referencedColumn: `accessId`,
							primaryColumn: `id`,
							columns: [{
								name: `id`,
							}, {
								name: `name`,
							}],
						},
					},
				},
			},
		},
	},
	columns: [{
		name: `id`,
	}, {
		name: `login`,
	}, {
		name: `fullname`,
	}, {
		name: `roleId`,
	}, {
		name: `contract`,
	}, {
		name: `createdAt`,
	}, {
		name: `updatedAt`,
	}],
};

describe('Select', () => {
	it(`The simplest query without parameters.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find().toString()).toBe(`SELECT *
FROM user
LIMIT 0, 20;`);
	});

	it(`Simple query with ordering.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			orders: {
				createdAt: `DESC`,
			},
		}).toString()).toBe(`SELECT *
FROM user
ORDER BY
	user.createdAt DESC
LIMIT 0, 20;`);
	});

	it(`Simple query with limit 1.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({ limit: 100 }).toString()).toBe(`SELECT *
FROM user
LIMIT 0, 100;`);
	});

	it(`Simple query with limit 2.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({ take: 100 }).toString()).toBe(`SELECT *
FROM user
LIMIT 0, 100;`);
	});

	it(`Simple query with offset 1.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({ skip: 5 }).toString()).toBe(`SELECT *
FROM user
LIMIT 5, 20;`);
	});

	it(`Simple query with offset 2.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({ offset: 5 }).toString()).toBe(`SELECT *
FROM user
LIMIT 5, 20;`);
	});

	it(`Simple query with offset 3.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({ page: 5 }).toString()).toBe(`SELECT *
FROM user
LIMIT 100, 20;`);
	});

	it(`Simple query defining fields from the current table.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			select: {
				id: true,
				login: true,
				fullname: true,
			},
		}).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname
FROM user
LIMIT 0, 20;`);
	});

	it(`Simple query with JOIN.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			relations: {
				role: true,
			},
			select: {
				id: true,
				login: true,
				fullname: true,
			},
		}).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname,
	role.id AS role_____id,
	role.name AS role_____name
FROM user
LEFT JOIN role ON user.roleId = role.id
LIMIT 0, 20;`);
	});

	it(`Simple query with JOIN and defining fields from joined table.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			relations: {
				role: true,
			},
			select: {
				id: true,
				login: true,
				fullname: true,
				role: {
					name: true,
				},
			},
		}).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname,
	role.name AS role_____name
FROM user
LEFT JOIN role ON user.roleId = role.id
LIMIT 0, 20;`);
	});

	it(`Query with multiple JOINs relative to the depth of the "relations" parameter.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			relations: {
				role: {
					roleAccesses: {
						access: true,
					},
				},
			},
			select: {
				id: true,
				login: true,
				fullname: true,
				role: {
					name: true,
				},
			},
		}).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname,
	role.name AS role_____name,
	role_access.id AS role_access_____id,
	role_access.roleId AS role_access_____roleId,
	role_access.accessId AS role_access_____accessId,
	access.id AS access_____id,
	access.name AS access_____name
FROM user
LEFT JOIN role ON user.roleId = role.id
LEFT JOIN role_access ON role_access.roleId = role.id
LEFT JOIN access ON role_access.accessId = access.id
LIMIT 0, 20;`);
	});

	it(`Simple query with condition definition (===).`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			where: {
				fullname: `john smith`,
			},
		}).toString()).toBe(`SELECT *
FROM user
WHERE
	(user.fullname = 'john smith')
LIMIT 0, 20;`);
	});

	it(`Simple query with condition definition (!=).`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			where: {
				fullname: `$Not('john smith')`,
			},
		}).toString()).toBe(`SELECT *
FROM user
WHERE
	(user.fullname != 'john smith')
LIMIT 0, 20;`);
	});

	it(`Simple query with multiple conditions defined.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			where: {
				contract: `example-contract-1`,
				updatedAt: `$LessThan('2025-05-10 13:00:00')`,

			},
		}).toString()).toBe(`SELECT *
FROM user
WHERE
	(user.contract = 'example-contract-1') AND (user.updatedAt < '2025-05-10 13:00:00')
LIMIT 0, 20;`);
	});

	it(`Simple query with array definition of conditions for one field 1.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			where: {
				login: [ `example-login-1`, `example-login-2` ]
			},
		}).toString()).toBe(`SELECT *
FROM user
WHERE
	(user.login = 'example-login-1') OR (user.login = 'example-login-2')
LIMIT 0, 20;`);
	});

	it(`Simple query with array definition of conditions for one field 2.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			where: [{
				login: `example-login-1`
			}, {
				login: `example-login-2`
			}],
		}).toString()).toBe(`SELECT *
FROM user
WHERE
	(user.login = 'example-login-1') OR (user.login = 'example-login-2')
LIMIT 0, 20;`);
	});

	it(`Query with conditions for joined tables.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			relations: {
				order: true,
			},
			where: {
				fullname: `john smith`,
				order: {
					product: `example-product-1`,
				},
			},
		}).toString()).toBe(`SELECT *
FROM user
LEFT JOIN order ON order.userId = user.id
WHERE
	(user.fullname = 'john smith') AND (order.product = 'example-product-1')
LIMIT 0, 20;`);
	});

	it(`Query defining aggregation conditions for joined tables.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			relations: {
				order: true,
				role: {
					roleAccesses: {
						access: true,
					},
				},
			},
			where: {
				order: {
					product: `example-product-1`,
				},
				role: {
					roleAccesses: {
						access: {
							name: `$Not($In(["example-access-1","example-access-2"]))`
						},
					},
				},
			},
		}).toString()).toBe(`SELECT *
FROM user
LEFT JOIN order ON order.userId = user.id
LEFT JOIN role ON user.roleId = role.id
LEFT JOIN role_access ON role_access.roleId = role.id
LEFT JOIN access ON role_access.accessId = access.id
WHERE
	(order.product = 'example-product-1') AND (access.name NOT IN ('example-access-1','example-access-2'))
LIMIT 0, 20;`);
	});

	it(`Simple query with group definition.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			select: {
				id: true,
				login: true,
				fullname: true,
				contract: true,
			},
			groups: {
				contract: true,
			},
		}).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname,
	user.contract AS user_____contract
FROM user
GROUP BY
	user.contract
LIMIT 0, 20;`);
	});

	it(`A query defining a group relative to the depth of the "groups" parameter.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			relations: {
				order: true,
			},
			select: {
				id: true,
				login: true,
				fullname: true,
				contract: true,
			},
			groups: {
				order: {
					status: true,
				},
			},
		}).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname,
	user.contract AS user_____contract,
	order.id AS order_____id,
	order.product AS order_____product,
	order.price AS order_____price,
	order.status AS order_____status,
	order.createdAt AS order_____createdAt
FROM user
LEFT JOIN order ON order.userId = user.id
GROUP BY
	order.status
LIMIT 0, 20;`);
	});

	it(`Query with group definition and combination of "where" and "having".`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			relations: {
				order: true,
			},
			select: {
				id: true,
				login: true,
				fullname: true,
				contract: true,
			},
			groups: {
				order: {
					status: true,
				},
			},
			where: {
				order: {
					price: [ `$Count($MoreThan(100))`, `$Max($Not($In([1,2,3])))` ],
					status: `Done`,
				},
			},
		}).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname,
	user.contract AS user_____contract,
	order.id AS order_____id,
	order.product AS order_____product,
	order.price AS order_____price,
	order.status AS order_____status,
	order.createdAt AS order_____createdAt
FROM user
LEFT JOIN order ON order.userId = user.id
WHERE
	(order.status = 'Done')
GROUP BY
	order.status
HAVING
	(COUNT(order.price) > '100') OR (MAX(order.price) NOT IN ('1','2','3'))
LIMIT 0, 20;`);
	});

	it(`Condition with $And operator.`, () => {
		expect((new StringToSqlBuilder(userMetadata)).find({
			relations: {
				order: true,
			},
			select: {
				id: true,
				login: true,
				fullname: true,
				contract: true,
			},
			groups: {
				order: {
					status: true,
				},
			},
			where: {
				order: {
					price: `$And([$Count($MoreThan(100)),$Not(200)])`,
					status: `Done`,
				},
			},
		}).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname,
	user.contract AS user_____contract,
	order.id AS order_____id,
	order.product AS order_____product,
	order.price AS order_____price,
	order.status AS order_____status,
	order.createdAt AS order_____createdAt
FROM user
LEFT JOIN order ON order.userId = user.id
WHERE
	(order.price != '200') AND (order.status = 'Done')
GROUP BY
	order.status
HAVING
	(COUNT(order.price) > '100')
LIMIT 0, 20;`);
	});
});
