import { XcmV3MultiassetAssetId, XcmV3MultiassetFungibility, XcmV3WeightLimit, XcmVersionedAssets } from '@polkadot-api/descriptors';
import { XcmV3Junctions } from '@polkadot-api/descriptors';
import { XcmV3Junction } from '@polkadot-api/descriptors';
import { XcmVersionedLocation } from '@polkadot-api/descriptors';
import { AccountId, Binary, SS58String } from 'polkadot-api';
import { XcmV4Location } from '../assets/types';


//create asset location for foreign asset from parachain, palletInstance, assetId
export function getXcmV3Multilocation(parents: number, parachain: number, palletInstance: number, assetId: bigint | number): XcmV4Location {
    return {
        parents: parents,
        interior: XcmV3Junctions.X3([
			XcmV3Junction.Parachain(parachain),
			XcmV3Junction.PalletInstance(palletInstance),
			XcmV3Junction.GeneralIndex(BigInt(assetId))
        ]),
    };
}

// Asset Hub (1000) to other parachain
export const transferFromAssetHubToPara = (
	api: any,
	paraId: number,
	address: SS58String,
	amount: bigint
) => ({
	type: "asset_hub_to_para" as const,
	call: api.tx.PolkadotXcm.limited_reserve_transfer_assets({
		dest: XcmVersionedLocation.V3({
			parents: 1, // Up to relay chain
			interior: XcmV3Junctions.X1(XcmV3Junction.Parachain(paraId)),
		}),
		beneficiary: getBeneficiary(address),
		assets: getNativeAsset(amount, 1), // DOT is from relay chain (parent: 1)
		fee_asset_item: 0,
		weight_limit: XcmV3WeightLimit.Unlimited(),
	}),
});

// From parachain to Asset Hub (1000)
export const transferParaToAssetHub = (
	api: any,
	paraId: number,
	address: SS58String,
	amount: bigint,
) => ({
	type: "para_to_asset_hub" as const,
	call: api.tx.PolkadotXcm.limited_reserve_transfer_assets({
		dest: XcmVersionedLocation.V3({
			parents: 1, // Up to relay chain
			interior: XcmV3Junctions.X1(XcmV3Junction.Parachain(paraId)), // Asset Hub paraID
		}),
		beneficiary: getBeneficiary(address),
		assets: getNativeAsset(amount, 0), // DOT is from relay chain (parent: 1) or HDX is from parachain (parent: 0)
		fee_asset_item: 0,
		weight_limit: XcmV3WeightLimit.Unlimited(),
	}),
});

const getBeneficiary = (address: SS58String) =>
	XcmVersionedLocation.V3({
		parents: 0,
		interior: XcmV3Junctions.X1(
			XcmV3Junction.AccountId32({
				network: undefined,
				id: Binary.fromBytes(encodeAccount(address)),
			}),
		),
	});

const getNativeAsset = (amount: bigint, parents: 1 | 0) =>
	XcmVersionedAssets.V3([
		{
			id: XcmV3MultiassetAssetId.Concrete({
				parents: parents, // 1 for relay chain DOT, 0 for local asset
				interior: XcmV3Junctions.Here(),
			}),
			fun: XcmV3MultiassetFungibility.Fungible(amount),
		},
	]);

const encodeAccount = AccountId().enc;
