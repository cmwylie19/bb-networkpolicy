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
    const ingressRule: any = {
      from: []
    }

    let spec: k8s.V1NetworkPolicySpec = {
      podSelector: {
        // matchLabels of the pods to which this policy applies
        matchLabels: networkPolicyMap
      },
      policyTypes: [],
      ingress: [],
      egress: []
    };

    try {

      for (const key in networkPolicyMap) {
        if (key.startsWith('egress/') || key.startsWith('ingress/')) {


          // build ingress/egress
          const isEgress = key.startsWith('egress/');

          spec.policyTypes.push(isEgress ? 'Egress' : 'Ingress');

          if (isEgress) {
            spec.egress.push({
              to: [] // array of objects
            });

          } else {
            spec.ingress.push({ from: [] })
          }

          const value = networkPolicyMap[key];

          let arrayElements = value.split('ALSO');
          // ['pod-run=green', 'pod-run=red.ns-name=blue']



          arrayElements.forEach((element, idx) => {
         

            // isolate each rule
            let rule = element.split('AND');
            rule.forEach(ruleElement => {

              // find out what kind
              if (ruleElement.startsWith('pod-')) {
                // find selector
                let podSelector = ruleElement.substring('pod-'.length);
                // split into key value
                let labels = podSelector.split('EQ');
                // append to the spec
                if (isEgress) {
                  if (spec.egress[0].to[idx] === undefined) {
                    spec.egress[0].to.push({
                      podSelector: {
                        matchLabels: {
                          [labels[0]]: labels[1]
                        }
                      }
                    })

                  } else {
                    spec.egress[0].to[idx].ipBlock = { cidr: '' }
                  }


                } else {
                  try {
                    if(spec.ingress[0].from[idx] == undefined){
                      spec.ingress[0].from.push({
                        podSelector: {
                          matchLabels: {
                            [labels[0]]: labels[1]
                          }
                        }
                      })
                    } else {
                      spec.ingress[0].from[idx].podSelector.matchLabels[labels[0]] = labels[1];
                    }
                 
                    // 
                    console.log(`SPEC\n${JSON.stringify(spec, undefined, 2)}`)
                  }
                  catch (err) {
                    console.log("with matchlabels " + err + "spec is " + JSON.stringify(spec, undefined, err))
                  }

                }
              } else if (ruleElement.startsWith("ipblock-")) {
                if (isEgress) {
                  if (spec.egress[0].to[idx].ipBlock === undefined) {
                    spec.egress[0].to.push({
                      ipBlock: {
                        cidr:ruleElement.substring('ipblock-'.length)
                      }
                    })
                    
                  } else {
                    spec.egress[0].to[idx].ipBlock.cidr = ruleElement.substring('ipblock-'.length);
                  }
                  
                } else {
                  if (spec.ingress[0].from[idx].ipBlock == undefined) {
                    spec.ingress[0].from[idx].ipBlock = { cidr: '' }
                  }

                  spec.ingress[0].from[idx].ipBlock.cidr = ruleElement.substring('ipblock-'.length);
                }

              }
              else if (ruleElement.startsWith("ns-")) {
                // find selector
                let podSelector = ruleElement.substring('ns-'.length);
                // split into key value
                let labels = podSelector.split('EQ');
                if (isEgress) {
                  if (spec.egress[0].to[idx] == undefined) {
                    spec.egress[0].to.push({
                      namespaceSelector:{
                        matchLabels:{
                          [labels[0]]:labels[1]
                        }
                      }
                    })
                    
                  } else {
                 
                    try {
                      
                      spec.egress[0].to[idx].namespaceSelector.matchLabels[labels[0]] = labels[1];
                    } catch(err) {
                      console.log(err, JSON.stringify(spec,undefined,2))
                    }
                    
                  }
                  
                }
                else {
                  if(spec.ingress[0].from[idx] === undefined) {
                    spec.ingress[0].from.push({
                      namespaceSelector:{
                        matchLabels:{
                          [labels[0]]:labels[1]
                        }
                      }
                    })
                  } else {
                    if (spec.ingress[0].from[idx].namespaceSelector == undefined) {
                      spec.ingress[0].from[idx].namespaceSelector = { matchLabels: {} }
                    }
                    spec.ingress[0].from[idx].namespaceSelector.matchLabels[labels[0]] = labels[1];
                  }
                
                }
              }
            })
          })

          const networkPolicy: k8s.V1NetworkPolicy = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'NetworkPolicy',
            metadata: {
              name,
              namespace,
            },
            spec: spec
          };

          await this.networkApi.createNamespacedNetworkPolicy(namespace, networkPolicy);
        }
      }
    } catch (error) {
      return error
    }
  }
}
