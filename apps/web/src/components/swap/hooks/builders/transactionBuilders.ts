import { AssetHubApi, AssetsMap } from '../types';
import { parseXcmLocation } from '../utils/assetUtils';
import { constructHydraDxXcmMessage, fetchHydraXCMLocation } from '@/services/xcm/xcmUtils';
import { FrontendConnectionManager } from '@/services/FrontendConnectionManager';

export const buildAssetHubTransaction = async (
  assetHubApi: AssetHubApi,
  assetsMap: AssetsMap,
  inputAssetId: string,
  outputAssetId: string,
  inputAmountPlanck: bigint,
  minOutputAmountPlanck: bigint,
  walletAddress: string,
  routePath?: string[]
) => {
  let path: any[] = [];
  try {
    if (routePath && routePath.length > 0) {
      // Using the route from routeState
      for (const assetId of routePath) {
        const asset = assetsMap.get(assetId);
        if (!asset?.rawXcmLocation) {
          throw new Error(`Missing XCM location for asset in path: ${assetId}`);
        }
        const parsedLocation = parseXcmLocation(asset.rawXcmLocation);
        path.push(parsedLocation);
      }
    } else {
      // Fallback to direct path
      const inputAsset = assetsMap.get(inputAssetId);
      const outputAsset = assetsMap.get(outputAssetId);
      if (!inputAsset?.rawXcmLocation || !outputAsset?.rawXcmLocation) {
        throw new Error('Missing XCM location information for assets');
      }
      path = [
        parseXcmLocation(inputAsset.rawXcmLocation),
        parseXcmLocation(outputAsset.rawXcmLocation)
      ];
    }

    return await assetHubApi.tx.AssetConversion.swap_exact_tokens_for_tokens({
      amount_in: inputAmountPlanck,
      amount_out_min: minOutputAmountPlanck,
      path: path,
      keep_alive: true,
      send_to: walletAddress
    });
  } catch (e: unknown) {
    console.error('Error constructing Asset Hub transaction:', e);
    throw new Error(`Failed to construct Asset Hub transaction: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
};

export const buildHydraDxTransaction = async (
  assetHubApi: AssetHubApi,
  assetsMap: AssetsMap,
  inputAssetId: string,
  outputAssetId: string,
  inputAmountPlanck: bigint,
  minOutputAmountPlanck: bigint,
  alicePublicKey: Uint8Array,
  walletAddress: string
) => {
  try {
    // Get HydraDX connection
    const hydraDxConnection = await FrontendConnectionManager.getInstance().getConnection('hydra_dx');
    if (!hydraDxConnection || !hydraDxConnection.api) {
      throw new Error('HydraDX RPC connection is not active.');
    }

    const inputAsset = assetsMap.get(inputAssetId);
    const outputAsset = assetsMap.get(outputAssetId);
    if (!inputAsset?.rawXcmLocation || !outputAsset?.rawXcmLocation) {
      throw new Error('Missing XCM location information for assets');
    }

    // Get XCM locations
    const inputAssetHubLocation = parseXcmLocation(inputAsset.rawXcmLocation);
    const outputAssetHubLocation = parseXcmLocation(outputAsset.rawXcmLocation);
    const inputHydraDxLocation = fetchHydraXCMLocation(inputAsset);
    const outputHydraDxLocation = fetchHydraXCMLocation(outputAsset);

    // Check if all locations are valid
    if (!inputAssetHubLocation || !outputAssetHubLocation) {
      throw new Error(`Missing required Asset Hub XCM location for ${!inputAssetHubLocation ? inputAssetId : outputAssetId}`);
    }
    if (!inputHydraDxLocation) {
      throw new Error(`Could not determine HydraDX-relative XCM location for input asset ${inputAssetId}`);
    }
    if (!outputHydraDxLocation) {
      throw new Error(`Could not determine HydraDX-relative XCM location for output asset ${outputAssetId}`);
    }

    // const calculatedFees = await calculateHydraDxXcmFees(
    //   assetHubApi,
    //   hydraDxConnection.api,
    //   inputAssetHubLocation,
    //   outputAssetHubLocation,
    //   inputAmountPlanck,
    //   minOutputAmountPlanck,
    //   alicePublicKey,
    //   walletAddress
    // );

    // Hardcoded fees for now
    const fees = {
      initialExecution: BigInt(48945000),
      initialDelivery: BigInt(307250000),
      hydradxExecution: BigInt(266095510),
      returnDelivery: BigInt(0),
      finalExecution: BigInt(3098000000)
    };

    // Construct XCM message
    const xcmMessage = await constructHydraDxXcmMessage(
      fees,
      inputAssetHubLocation,
      outputAssetHubLocation,
      inputHydraDxLocation,
      outputHydraDxLocation,
      inputAmountPlanck,
      minOutputAmountPlanck,
      alicePublicKey
    );

    // Calculate final weight
    const xcmWeight = await assetHubApi.apis.XcmPaymentApi.query_xcm_weight(xcmMessage);
    if (!xcmWeight.success) {
      throw new Error("Failed to calculate total XCM weight");
    }

    return assetHubApi.tx.PolkadotXcm.execute({
      message: xcmMessage,
      max_weight: {
        ref_time: xcmWeight.value.ref_time,
        proof_size: xcmWeight.value.proof_size
      }
    });
  } catch (e: unknown) {
    console.error('Error in HydraDX swap preparation:', e);
    throw new Error(`Failed to prepare HydraDX swap: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}; 