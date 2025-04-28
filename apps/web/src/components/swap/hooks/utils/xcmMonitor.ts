import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';

/**
 * Monitors XCM transaction flow on Asset Hub
 * @param {TypedApi<typeof polkadot_asset_hub>} assetHubApi - Asset Hub chain API
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<boolean>} Resolves when XCM flow completes successfully
 */
export async function monitorXcmFlow(
    assetHubApi: TypedApi<typeof polkadot_asset_hub>,
    walletAddress: string,
  ): Promise<boolean> {
    console.log("=== Starting XCM Flow Monitoring ===");
    
    let assetHubSubscription: { unsubscribe: () => void } | null = null;
    let isCompleted = false;
  
    return new Promise<boolean>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (!isCompleted) {
          console.log("XCM monitoring timed out after 2 minutes");
          cleanup();
          resolve(false);
        }
      }, 2 * 60 * 1000);
  
      let xcmInitiated = false;
      let assetTransferred = false;
  
      const cleanup = () => {
        if (isCompleted) return;
        isCompleted = true;
        clearTimeout(timeoutId);
  
        if (assetHubSubscription) {
          try {
            assetHubSubscription.unsubscribe();
            assetHubSubscription = null;
          } catch (e) {
            console.warn("Error unsubscribing from Asset Hub events:", e);
          }
        }
      };
  
      const checkCompletion = () => {
        if (xcmInitiated && assetTransferred && !isCompleted) {
          cleanup();
          console.log("\n✅ Asset Hub XCM flow successful!");
          resolve(true);
        }
      };
  
      try {
        // Subscribe to Asset Hub events
        const assetHubObservable = assetHubApi.query.System.Events.watchValue("finalized");
        assetHubSubscription = assetHubObservable.subscribe({
          next: (events) => {
            if (isCompleted) return;
  
            for (const record of events) {
              const eventData = record.event;
  
              // Check for PolkadotXcm events
              if (eventData.type === 'PolkadotXcm') {
                const xcmEvent = eventData.value;
                if (xcmEvent.type === 'Attempted' && !xcmInitiated) {
                  console.log("✅ Initial XCM from Asset Hub sent successfully");
                  xcmInitiated = true;
                  checkCompletion();
                }
              }
  
              // Check for Assets events
              if (eventData.type === 'Assets') {
                const balanceEvent = eventData.value;
                if (balanceEvent.type === 'Issued') {
                  const issuedData = balanceEvent.value;
                  if (issuedData.owner === walletAddress) {
                    console.log(`✅ Final asset transfer detected to ${walletAddress}`);
                    assetTransferred = true;
                    checkCompletion();
                  }
                }
              }
            }
          },
          error: (error) => {
            if (!isCompleted) {
              console.error("Error in Asset Hub event monitoring:", error);
              cleanup();
              reject(error);
            }
          },
          complete: () => {
            console.log("Asset Hub subscription completed");
          }
        });
      } catch (error) {
        if (!isCompleted) {
          console.error("Error in event monitoring:", error);
          cleanup();
          resolve(false);
        }
      }
  
      return cleanup;
    });
  }