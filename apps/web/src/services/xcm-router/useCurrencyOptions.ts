'use client';

import type { TAssetInfo, TChain } from "@paraspell/sdk";

import { useMemo } from "react";
import type { TExchangeInput, TExchangeChain  } from "@paraspell/xcm-router";
import {
  getSupportedAssetsFrom,
  getSupportedAssetsTo,
} from "@paraspell/xcm-router";

// This hook is used to get the currency options
// for the currencyFrom and currencyTo fields in the transfer form.
const useCurrencyOptions = (
  from: TChain | undefined,
  exchangeNode: TExchangeChain [],
  to: TChain | undefined,
  targetNetworks?: string[] // Optional: Registry-driven network filtering
) => {
  // Transform exchange so that when its only one items it is not an array
  const exchange = exchangeNode.length > 1 ? exchangeNode : exchangeNode[0];

  // Get the supported assets for the currencyFrom field
  const supportedAssetsFrom = useMemo(() => {
    if (targetNetworks) {
      // Registry-driven: Query specific networks only
      const allAssets: Array<TAssetInfo & { _network: string }> = [];
      targetNetworks.forEach(network => {
        try {
          const assets = getSupportedAssetsFrom(network as TChain, exchange as TExchangeInput);
          // Add network information to each asset for key generation
          const assetsWithNetwork = assets.map(asset => ({ ...asset, _network: network } as TAssetInfo & { _network: string }));
          allAssets.push(...assetsWithNetwork);
        } catch (error) {
          console.warn(`Failed to fetch FROM assets for ${network}:`, error);
        }
      });
      return allAssets;
    }
    // Fallback to original behavior
    const assets = getSupportedAssetsFrom(from, exchange as TExchangeInput);
    return assets.map(asset => ({ ...asset, _network: from } as TAssetInfo & { _network: string }));
  }, [from, exchangeNode, targetNetworks]);

  // Get the supported assets for the currencyTo field
  const supportedAssetsTo = useMemo(() => {
    if (targetNetworks) {
      // Registry-driven: Query specific networks only
      const allAssets: Array<TAssetInfo & { _network: string }> = [];
      targetNetworks.forEach(network => {
        try {
          const assets = getSupportedAssetsTo(exchange as TExchangeInput, network as TChain);
          // Add network information to each asset for key generation
          const assetsWithNetwork = assets.map(asset => ({ ...asset, _network: network } as TAssetInfo & { _network: string }));
          allAssets.push(...assetsWithNetwork);
        } catch (error) {
          console.warn(`Failed to fetch TO assets for ${network}:`, error);
        }
      });
      return allAssets;
    }
    // Fallback to original behavior
    const assets = getSupportedAssetsTo(exchange as TExchangeInput, to);
    return assets.map(asset => ({ ...asset, _network: to } as TAssetInfo & { _network: string }));
  }, [exchangeNode, to, targetNetworks]);

  // Create a map of the supported assets for the currencyFrom field
  const currencyFromMap = useMemo(
    () =>
      supportedAssetsFrom.reduce((map: Record<string, TAssetInfo>, asset) => {
        const key = `${asset.symbol ?? "NO_SYMBOL"}-${
          "assetId" in asset ? asset.assetId : "native"
        }-${asset._network ?? "UNKNOWN_NETWORK"}`;

        map[key] = asset;
        return map;
      }, {}),
    [supportedAssetsFrom]
  );

  // Create a map of the supported assets for the currencyTo field
  const currencyToMap = useMemo(
    () =>
      supportedAssetsTo.reduce((map: Record<string, TAssetInfo>, asset) => {
        const key = `${asset.symbol ?? "NO_SYMBOL"}-${
          "assetId" in asset ? asset.assetId : "native"
        }-${asset._network ?? "UNKNOWN_NETWORK"}`;
        map[key] = asset as TAssetInfo;
        return map;
      }, {}),
    [supportedAssetsTo]
  );

  // Create the select options for the currencyFrom field
  const currencyFromOptions = useMemo(
    () =>
      Object.keys(currencyFromMap).map((key) => ({
        value: key,
        label: `${currencyFromMap[key].symbol} - ${
          "assetId" in currencyFromMap[key] ||
          "multiLocation" in currencyFromMap[key]
            ? "assetId" in currencyFromMap[key]
              ? currencyFromMap[key].assetId
              : "Multi-Location"
            : "Native"
        } - ${(currencyFromMap[key] as any)._network ?? "Unknown"}`,
      })),
    [currencyFromMap]
  );

  // Create the select options for the currencyTo field
  const currencyToOptions = useMemo(
    () =>
      Object.keys(currencyToMap).map((key) => ({
        value: key,
        label: `${currencyToMap[key].symbol} - ${
          "assetId" in currencyToMap[key] ||
          "multiLocation" in currencyToMap[key]
            ? "assetId" in currencyToMap[key]
              ? currencyToMap[key].assetId
              : "Multi-location"
            : "Native"
        } - ${(currencyToMap[key] as any)._network ?? "Unknown"}`,
      })),
    [currencyToMap]
  );

  return {
    currencyFromOptions,
    currencyToOptions,
    currencyFromMap,
    currencyToMap,
  };
};

export default useCurrencyOptions;
