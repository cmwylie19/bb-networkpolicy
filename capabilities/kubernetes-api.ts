import * as k8s from "@kubernetes/client-node";


interface NetworkPolicyMap {
  [key: string]: string;
}

export class K8sAPI {
  k8sApi: k8s.CoreV1Api;
  networkApi: k8s.NetworkingV1Api

  constructor() {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.networkApi = kc.makeApiClient(k8s.NetworkingV1Api);
  }


  async buildNetworkPolicies(networkPolicyMap: NetworkPolicyMap, name: string, namespace: string): Promise<void> {

    let networkPolicy: k8s.V1NetworkPolicy

    let spec: k8s.V1NetworkPolicySpec = {
      podSelector: {
        matchLabels: networkPolicyMap
      },
      policyTypes: [],
      ingress: [],
      egress: []
    };
    let policyCount  =0
    try {
      for (const key in networkPolicyMap) {
        if (key.startsWith('egress/') || key.startsWith('ingress/')) {

          const isEgress = key.startsWith('egress/');


          // spec.policyTypes.push(isEgress ? 'Egress' : 'Ingress');

          if (isEgress) {
            if (!spec.policyTypes.includes('Egress')) {
              spec.policyTypes.push('Egress');
            }
            spec.egress.push({ to: [] });
          } else {
            if (!spec.policyTypes.includes('Ingress')) {
              spec.policyTypes.push("Ingress");
            }
            spec.ingress.push({ from: [] })
          }

          const value = networkPolicyMap[key];
          // ALSO splits rules
          // EX ['pod-run=green', 'pod-run=redANDns-name=blue']
          let arrayElements = value.split('ALSO');

          arrayElements.forEach((element, idx) => {

            // isolate each rule
            let rule = element.split('AND');
            rule.forEach(ruleElement => {

              // Identify kind
              if (ruleElement.startsWith('pod-')) {
                // find selector
                let podSelector = ruleElement.substring('pod-'.length);
                // split into key value
                let labels = podSelector.split('EQ');
                // append to the spec
                if (isEgress) {
                  if (spec.egress[policyCount].to[idx] === undefined) {
                    spec.egress[policyCount].to.push({
                      podSelector: {
                        matchLabels: {
                          [labels[0]]: labels[1]
                        }
                      }
                    })
                  } else {
                    if (spec.egress[policyCount].to[idx].podSelector === undefined) {
                      spec.egress[policyCount].to[idx].podSelector = { matchLabels: {} }
                    }
                    spec.egress[policyCount].to[idx].podSelector.matchLabels[labels[0]] = labels[1];
                  }
                } else {
                  if (spec.ingress[policyCount].from[idx] == undefined) {
                    spec.ingress[policyCount].from.push({
                      podSelector: {
                        matchLabels: {
                          [labels[0]]: labels[1]
                        }
                      }
                    })
                  } else {
                    if (spec.ingress[policyCount].from[idx].podSelector === undefined) {
                      spec.ingress[policyCount].from[idx].podSelector = { matchLabels: {} }
                    }
                    spec.ingress[policyCount].from[idx].podSelector.matchLabels[labels[0]] = labels[1];
                  }
                }
              } else if (ruleElement.startsWith("ipblock-")) {
                if (isEgress) {
                  if (spec.egress[policyCount].to[idx] === undefined) {
                    spec.egress[policyCount].to.push({
                      ipBlock: {
                        cidr: ruleElement.substring('ipblock-'.length)
                      }
                    })

                  } else {
                    if (spec.egress[policyCount].to[idx].ipBlock == undefined) {
                      spec.egress[policyCount].to[idx].ipBlock = { cidr: "" }
                    }
                    spec.egress[policyCount].to[idx].ipBlock.cidr = ruleElement.substring('ipblock-'.length);
                  }

                } else {
                  if (spec.ingress[policyCount].from[idx].ipBlock == undefined) {
                    spec.ingress[policyCount].from[idx].ipBlock = { cidr: '' }
                  }
                  spec.ingress[policyCount].from[idx].ipBlock.cidr = ruleElement.substring('ipblock-'.length);
                }

              }
              else if (ruleElement.startsWith("ns-")) {
                // find selector
                let podSelector = ruleElement.substring('ns-'.length);
                // split into key value
                let labels = podSelector.split('EQ');
                if (isEgress) {
                  if (spec.egress[policyCount].to[idx] == undefined) {
                    spec.egress[policyCount].to.push({
                      namespaceSelector: {
                        matchLabels: {
                          [labels[0]]: labels[1]
                        }
                      }
                    })

                  } else {
                    if (spec.egress[policyCount].to[idx].namespaceSelector == undefined) {
                      spec.egress[policyCount].to[idx].namespaceSelector = { matchLabels: {} }
                    }
                    spec.egress[policyCount].to[idx].namespaceSelector.matchLabels[labels[0]] = labels[1];
                  }

                }
                else {
                  if (spec.ingress[policyCount].from[idx] === undefined) {
                    spec.ingress[policyCount].from.push({
                      namespaceSelector: {
                        matchLabels: {
                          [labels[0]]: labels[1]
                        }
                      }
                    })
                  } else {
                    if (spec.ingress[policyCount].from[idx].namespaceSelector == undefined) {
                      spec.ingress[policyCount].from[idx].namespaceSelector = { matchLabels: {} }
                    }
                    spec.ingress[policyCount].from[idx].namespaceSelector.matchLabels[labels[0]] = labels[1];
                  }

                }
              }
            })
          })


          policyCount++
        }
        networkPolicy = {
          apiVersion: 'networking.k8s.io/v1',
          kind: 'NetworkPolicy',
          metadata: {
            name,
            namespace,
          },
          spec: spec
        };
      }
      await this.networkApi.createNamespacedNetworkPolicy(namespace, networkPolicy);
    } catch (error) {
      return error
    }
  }
}
