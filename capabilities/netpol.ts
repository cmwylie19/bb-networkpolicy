import {
  Capability,
  Log,
  a,
} from "pepr";
import { K8sAPI } from "./kubernetes-api"
import { LogLevel } from "pepr/dist/lib/logger";
/**
 *  The HelloPepr Capability is an example capability to demonstrate some general concepts of Pepr.
 *  To test this capability you run `pepr dev`and then run the following command:
 *  `kubectl apply -f capabilities/hello-pepr.samples.yaml`
 */
export const NetPol = new Capability({
  name: "NetPol",
  description: "Creates NetworkPolicies based on labels.",
  namespaces: [],
});

// Use the 'When' function to create a new Capability Action
const { When } = NetPol;
const k8sAPI = new K8sAPI()


/**
 * ---------------------------------------------------------------------------------------------------
 *                                   CAPABILITY ACTION (Pod)                                   *
 * ---------------------------------------------------------------------------------------------------
 *
 * This Capability Action creates Network Policies based on labels.
 * The label format 
 * `pepr.dev/netpol` // enables network policy
 */

When(a.Pod)
  .IsCreatedOrUpdated()
  .WithLabel("pepr.dev/netpol")
  .Then(async po => {
    Log.SetLogLevel("debug");
    Log.info(`Pod Raw ${JSON.stringify(po.Raw,undefined,2)}`);
    Log.info(`Pod ${po.Raw.metadata.generateName} created or updated`);
    //let generatedName = po.Raw.metadata.generateName.split('-')[0]
    let generatedName = po.Raw.metadata.name
    const { labels, namespace } = po.Raw.metadata
    try {
      await k8sAPI.buildNetworkPolicies(labels, generatedName, namespace);
      Log.info(`NetworkPolicy ${generatedName} created in ${namespace}`);
    } catch (err) {
      Log.error(`Failed to create NetworkPolicy for Pod ${generatedName} in namespace ${namespace}: ${err}`);
    }
  });
