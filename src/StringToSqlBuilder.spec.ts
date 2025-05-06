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
				role_access: {
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
		name: `createdAt`,
	}, {
		name: `updatedAt`,
	}],
};
const defaultQuery = {
	relations: {
		role: {
			role_access: {
				access: true,
			},
		},
	},
	select: {
		id: true,
		login: true,
		fullname: true,
		createdAt: true,
		updatedAt: true,
		role: {
			id: true,
			name: true,
			role_access: {
				roleId: true,
				accessId: true,
				access: {
					id: true,
					name: true,
				},
			},
		},
	},
	orders: {
		updatedAt: `DESC`,
	},
	where: {
		login: `$Not($Like("example-user-login-1"))`,
		access: {
			name: '$Not($In(["example-access-name-1","example-access-name-2"]))',
		},
	},
};
const defaultBuilder = (new StringToSqlBuilder(userMetadata));

describe('Device', () => {
	it(`Default select rows.`, () => {
		expect(defaultBuilder.find(defaultQuery).toString()).toBe(`SELECT
	user.id AS user_____id,
	user.login AS user_____login,
	user.fullname AS user_____fullname,
	user.createdAt AS user_____createdAt,
	user.updatedAt AS user_____updatedAt,
	role.id AS role_____id,
	role.name AS role_____name,
	role_access.roleId AS role_access_____roleId,
	role_access.accessId AS role_access_____accessId,
	access.id AS access_____id,
	access.name AS access_____name
FROM user
LEFT JOIN role ON user.roleId = role.id
LEFT JOIN role_access ON role_access.roleId = role.id
LEFT JOIN access ON role_access.accessId = access.id
WHERE
	(user.login NOT LIKE 'example-user-login-1') AND (access.name NOT IN ('example-access-name-1','example-access-name-2'))
ORDER BY
	user.updatedAt DESC
LIMIT 0, 20;`);
	});

	it(`Default count rows.`, () => {
		expect(defaultBuilder.count(defaultQuery).toString()).toBe(`SELECT
COUNT(DISTINCT user.id) AS total
FROM user
LEFT JOIN role ON user.roleId = role.id
LEFT JOIN role_access ON role_access.roleId = role.id
LEFT JOIN access ON role_access.accessId = access.id
WHERE
	(user.login NOT LIKE 'example-user-login-1') AND (access.name NOT IN ('example-access-name-1','example-access-name-2'));`);
	});

	it(`Default group rows and having.`, () => {
		const builder = (new StringToSqlBuilder(userMetadata));

		expect(builder.find({
			relations: {
				order: true,
			},
			select: {
				id: true,
				login: true,
				fullname: true,
				order: {
					id: true,
					price: true,
					status: true,
				},
			},
			groups: {
				order: {
					status: true,
				},
			},
			orders: {
				order: {
					createdAt: `DESC`,
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
	order.id AS order_____id,
	order.price AS order_____price,
	order.status AS order_____status
FROM user
LEFT JOIN order ON order.userId = user.id
WHERE
	(order.status = 'Done')
GROUP BY
	order.status
HAVING
	(COUNT(order.price) > '100') OR (MAX(order.price) NOT IN ('1','2','3'))
ORDER BY
	order.createdAt DESC
LIMIT 0, 20;`);
	});

	it(`Default group rows, having and complex where.`, () => {
		const builder = new StringToSqlBuilder(userMetadata);

		expect(builder.find({
			relations: {
				order: true,
			},
			select: {
				id: true,
				login: true,
				fullname: true,
				order: {
					id: true,
					price: true,
					status: true,
				},
			},
			groups: {
				order: {
					status: true,
				},
			},
			orders: {
				order: {
					createdAt: `DESC`,
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
	order.id AS order_____id,
	order.price AS order_____price,
	order.status AS order_____status
FROM user
LEFT JOIN order ON order.userId = user.id
WHERE
	(order.price != '200') AND (order.status = 'Done')
GROUP BY
	order.status
HAVING
	(COUNT(order.price) > '100')
ORDER BY
	order.createdAt DESC
LIMIT 0, 20;`);
	});
});
