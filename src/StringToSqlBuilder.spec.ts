import { StringToSqlBuilder } from '../src/StringToSqlBuilder';

describe('Device', () => {
	it(`Default`, () => {
		const stringToSqlBuilder = (new StringToSqlBuilder({
			tableName: `device`,
			relations: {
				area: {
					type: `many-to-one`,
					tableName: `area`,
					referencedTableName: `device`,
					referencedColumn: `areaId`,
					primaryColumn: `id`,
					columns: [{
						name: `id`,
					}, {
						name: `name`,
					}],
					relations: {
						rangeips: {
							type: `one-to-many`,
							tableName: `rangeip`,
							referencedTableName: `area`,
							referencedColumn: `areaId`,
							primaryColumn: `id`,
							columns: [{
								name: `id`,
							}, {
								name: `from`,
							}, {
								name: `to`,
							}],
						},
					},
				},
				model: {
					type: `many-to-one`,
					tableName: `model`,
					referencedTableName: `device`,
					referencedColumn: `modelId`,
					primaryColumn: `id`,
					columns: [{
						name: `id`,
					}, {
						name: `name`,
					}, {
						name: `nominalEnergy`,
					}],
				},
			},
			columns: [{
				name: `id`,
			}, {
				name: `ipaddr`,
			}, {
				name: `macaddr`,
			}, {
				name: `login`,
			}, {
				name: `password`,
			}, {
				name: `port`,
			}, {
				name: `areaId`,
			}, {
				name: `modelId`,
			}, {
				name: `createdAt`,
			}, {
				name: `updatedAt`,
			}],
		}, {
			relations: {
				area: {
					rangeips: true,
				},
				model: true,
			},
			select: {
				id: true,
				ipaddr: true,
				macaddr: true,
				createdAt: true,
				updatedAt: true,
				area: {
					id: true,
					rangeips: {
						id: true,
					},
				},
			},
			orders: {
				updatedAt: `DESC`,
			},
			where: {
				areaId: `$Not($Like("example-area-id-1"))`,
				model: {
					nominalEnergy: '$Not($In(["hello","hello2"]))',
				},
			},
		}));

		expect(stringToSqlBuilder.find().toString()).toBe(`SELECT
	device.id AS device_____id,
	device.ipaddr AS device_____ipaddr,
	device.macaddr AS device_____macaddr,
	device.createdAt AS device_____createdAt,
	device.updatedAt AS device_____updatedAt,
	area.id AS area_____id,
	rangeip.id AS rangeip_____id,
	model.id AS model_____id,
	model.name AS model_____name,
	model.nominalEnergy AS model_____nominalEnergy
FROM device
LEFT JOIN area ON device.areaId = area.id
LEFT JOIN rangeip ON rangeip.areaId = area.id
LEFT JOIN model ON device.modelId = model.id
WHERE
	(device.areaId NOT LIKE 'example-area-id-1') AND (model.nominalEnergy NOT IN ('hello','hello2'))
ORDER BY
	device.updatedAt DESC
LIMIT 0, 20;`);
	});
});
