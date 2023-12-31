# BB Network Policy

- [Create Cluster](#create-cluster)

## Create Cluster

We must enable network policy, choose a pod subnet that is different than your local subnet.


```bash
cat  >config.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30001
        hostPort: 80
networking:
  disableDefaultCNI: true
  podSubnet: "172.16.0.0/12"
EOF

kind create cluster --config config.yaml
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/calico.yaml
```

```bash
kubectl create -f -<<EOF
apiVersion: v1
kind: Namespace
metadata:
  creationTimestamp: null
  name: blue
  labels:
    name: blue
spec: {}
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: blue
    pepr.dev/netpol: enabled
    ingress/1: pod-runEQgreenALSOpod-runEQredANDns-nameEQblue
    egress/test: pod-runEQgreenALSOpod-runEQredANDns-nameEQblue
  name: blue
spec:
  containers:
  - image: nginx
    name: blue
    ports:
    - containerPort: 80
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: red
  name: red
  namespace: blue
spec:
  containers:
  - image: nginx
    name: red
    ports:
    - containerPort: 80
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: green
  name: green
spec:
  containers:
  - image: nginx
    name: green
    ports:
    - containerPort: 80
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
EOF
# ---
# k create -f -<<EOF
# kind: NetworkPolicy
# apiVersion: networking.k8s.io/v1
# metadata:
#   namespace: default
#   name: blue
# spec:
#   podSelector:
#     matchLabels:
#       run: blue
#   ingress:
#   - from:
#     - podSelector:
#         matchLabels:
#           run: red
#           run: green
# ---
# kubectl create -f -<<EOF
# kind: NetworkPolicy
# apiVersion: networking.k8s.io/v1
# metadata:
#   name: blue
#   # ingress/1: pod###run=green,pod###run=red&ns###name=blue
#   # egress/1: pod###run=green,pod###run=red&ns###name=blue
# spec:
#   podSelector:
#     matchLabels:
#       run: blue
#   egress:
#   - to:
#       - podSelector:
#           matchLabels:
#             run: red
#         namespaceSelector:
#           matchLabels:
#             name: blue
#       - podSelector:
#           matchLabels:
#             run: green
#   ingress:
#   - from:
#       - podSelector:
#           matchLabels:
#             run: red
#         namespaceSelector:
#           matchLabels:
#             name: blue
#       - podSelector:
#           matchLabels:
#             run: green
EOF
```

Test the network policy

Curl against blue pod from red pod in blue namespace
```bash
BLUE_IP=$(kubectl get po blue --template='{{.status.podIP}}')
k exec -it red -n blue -- curl -I $BLUE_IP

k exec it green  -- curl -I $BLUE_IP
```

Create a purple pod to make sure it's blocked
```bash
k run purple --image=nginx:alpine --rm -it --restart=Never  -- curl $BLUE_IP
```
