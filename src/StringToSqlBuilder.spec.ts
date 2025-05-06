import { StringToSqlBuilder } from '../src/StringToSqlBuilder';

describe('Device', () => {
	it(`Default`, () => {
		const stringToSqlBuilder = (new StringToSqlBuilder({
			tableName: `user`,
			relations: {
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
		}, {
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
		}));

		console.log('?????????????????????', stringToSqlBuilder.count().toString());

		expect(stringToSqlBuilder.find().toString()).toBe(`SELECT
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
});
