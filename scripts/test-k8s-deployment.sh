#!/bin/bash

# Kubernetes Deployment Testing Script for RiggerConnect API
# This script provides comprehensive testing for Kubernetes deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="rigger-connect"
APP_NAME="rigger-connect-api"
IMAGE_NAME="tiation/rigger-connect-api:latest"
DEPLOYMENT_FILE="kubernetes/deployment.yaml"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed or not in PATH"
        exit 1
    fi
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    local deployment_name=$1
    local namespace=$2
    local timeout=${3:-300}
    
    print_status "Waiting for deployment $deployment_name to be ready..."
    
    if kubectl wait --for=condition=available --timeout=${timeout}s deployment/$deployment_name -n $namespace; then
        print_success "Deployment $deployment_name is ready"
        return 0
    else
        print_error "Deployment $deployment_name failed to become ready within ${timeout}s"
        return 1
    fi
}

# Function to test pod health
test_pod_health() {
    local namespace=$1
    local app_label=$2
    
    print_status "Testing pod health for app=$app_label in namespace=$namespace..."
    
    # Get pod names
    pods=$(kubectl get pods -n $namespace -l app=$app_label -o jsonpath='{.items[*].metadata.name}')
    
    if [ -z "$pods" ]; then
        print_error "No pods found for app=$app_label"
        return 1
    fi
    
    for pod in $pods; do
        print_status "Checking pod: $pod"
        
        # Check pod status
        status=$(kubectl get pod $pod -n $namespace -o jsonpath='{.status.phase}')
        if [ "$status" != "Running" ]; then
            print_error "Pod $pod is not running (status: $status)"
            kubectl describe pod $pod -n $namespace
            return 1
        fi
        
        # Check readiness
        ready=$(kubectl get pod $pod -n $namespace -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
        if [ "$ready" != "True" ]; then
            print_error "Pod $pod is not ready"
            kubectl describe pod $pod -n $namespace
            return 1
        fi
        
        print_success "Pod $pod is healthy"
    done
    
    return 0
}

# Function to test service endpoints
test_service_endpoints() {
    local namespace=$1
    local service_name=$2
    
    print_status "Testing service endpoints for $service_name..."
    
    # Check if service exists
    if ! kubectl get service $service_name -n $namespace &> /dev/null; then
        print_error "Service $service_name not found"
        return 1
    fi
    
    # Get service endpoints
    endpoints=$(kubectl get endpoints $service_name -n $namespace -o jsonpath='{.subsets[*].addresses[*].ip}')
    
    if [ -z "$endpoints" ]; then
        print_error "No endpoints found for service $service_name"
        kubectl describe service $service_name -n $namespace
        return 1
    fi
    
    print_success "Service $service_name has endpoints: $endpoints"
    return 0
}

# Function to test application health endpoint
test_health_endpoint() {
    local namespace=$1
    local service_name=$2
    local health_path=${3:-"/health"}
    
    print_status "Testing health endpoint $health_path..."
    
    # Port forward to test the health endpoint
    print_status "Setting up port forwarding..."
    kubectl port-forward service/$service_name -n $namespace 8080:80 &
    PF_PID=$!
    
    # Wait for port forward to be ready
    sleep 5
    
    # Test health endpoint
    if curl -s -f "http://localhost:8080$health_path" > /dev/null; then
        print_success "Health endpoint is responding"
        health_response=$(curl -s "http://localhost:8080$health_path")
        print_status "Health response: $health_response"
        result=0
    else
        print_error "Health endpoint is not responding"
        result=1
    fi
    
    # Kill port forward
    kill $PF_PID 2>/dev/null || true
    
    return $result
}

# Function to test resource limits and requests
test_resource_limits() {
    local namespace=$1
    local app_label=$2
    
    print_status "Testing resource limits and requests..."
    
    pods=$(kubectl get pods -n $namespace -l app=$app_label -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $pods; do
        print_status "Checking resources for pod: $pod"
        
        # Get resource requests and limits
        requests=$(kubectl get pod $pod -n $namespace -o jsonpath='{.spec.containers[0].resources.requests}')
        limits=$(kubectl get pod $pod -n $namespace -o jsonpath='{.spec.containers[0].resources.limits}')
        
        if [ -z "$requests" ] || [ -z "$limits" ]; then
            print_warning "Pod $pod does not have resource requests/limits configured"
        else
            print_success "Pod $pod has resource configuration:"
            print_status "  Requests: $requests"
            print_status "  Limits: $limits"
        fi
    done
}

# Function to test security context
test_security_context() {
    local namespace=$1
    local app_label=$2
    
    print_status "Testing security context..."
    
    pods=$(kubectl get pods -n $namespace -l app=$app_label -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $pods; do
        print_status "Checking security context for pod: $pod"
        
        # Check if running as non-root
        run_as_user=$(kubectl get pod $pod -n $namespace -o jsonpath='{.spec.securityContext.runAsUser}')
        run_as_non_root=$(kubectl get pod $pod -n $namespace -o jsonpath='{.spec.securityContext.runAsNonRoot}')
        
        if [ "$run_as_non_root" = "true" ] && [ "$run_as_user" != "0" ]; then
            print_success "Pod $pod is running with proper security context (non-root)"
        else
            print_warning "Pod $pod may not be running with optimal security settings"
        fi
    done
}

# Function to run load test
run_load_test() {
    local namespace=$1
    local service_name=$2
    local duration=${3:-30}
    local concurrent=${4:-10}
    
    print_status "Running load test for $duration seconds with $concurrent concurrent connections..."
    
    # Check if hey is available
    if ! command -v hey &> /dev/null; then
        print_warning "Load testing tool 'hey' is not installed. Skipping load test."
        print_status "Install with: go install github.com/rakyll/hey@latest"
        return 0
    fi
    
    # Port forward for load test
    kubectl port-forward service/$service_name -n $namespace 8080:80 &
    PF_PID=$!
    
    # Wait for port forward
    sleep 5
    
    # Run load test
    hey -z ${duration}s -c $concurrent http://localhost:8080/health
    
    # Kill port forward
    kill $PF_PID 2>/dev/null || true
    
    print_success "Load test completed"
}

# Function to check logs for errors
check_logs() {
    local namespace=$1
    local app_label=$2
    
    print_status "Checking recent logs for errors..."
    
    pods=$(kubectl get pods -n $namespace -l app=$app_label -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $pods; do
        print_status "Checking logs for pod: $pod"
        
        # Get recent logs and check for errors
        logs=$(kubectl logs $pod -n $namespace --tail=50)
        
        if echo "$logs" | grep -i "error\|exception\|failed" > /dev/null; then
            print_warning "Found potential errors in logs for pod $pod:"
            echo "$logs" | grep -i "error\|exception\|failed" | head -5
        else
            print_success "No obvious errors found in logs for pod $pod"
        fi
    done
}

# Main testing function
main() {
    print_status "Starting Kubernetes deployment testing for RiggerConnect API..."
    
    # Check prerequisites
    check_command kubectl
    check_command curl
    check_command docker
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please ensure cluster is running."
        exit 1
    fi
    
    print_success "Connected to Kubernetes cluster"
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        print_status "Creating namespace $NAMESPACE..."
        kubectl create namespace $NAMESPACE
    fi
    
    # Apply deployment
    print_status "Applying Kubernetes deployment..."
    kubectl apply -f $DEPLOYMENT_FILE
    
    # Wait for deployment to be ready
    if ! wait_for_deployment $APP_NAME $NAMESPACE 300; then
        print_error "Deployment failed to become ready"
        exit 1
    fi
    
    # Run tests
    print_status "Running deployment tests..."
    
    test_pod_health $NAMESPACE $APP_NAME
    test_service_endpoints $NAMESPACE "${APP_NAME}-service"
    test_health_endpoint $NAMESPACE "${APP_NAME}-service" "/health"
    test_resource_limits $NAMESPACE $APP_NAME
    test_security_context $NAMESPACE $APP_NAME
    check_logs $NAMESPACE $APP_NAME
    
    # Optional load test
    if [ "$1" = "--load-test" ]; then
        run_load_test $NAMESPACE "${APP_NAME}-service" 30 10
    fi
    
    print_success "All tests completed successfully!"
    
    # Display useful information
    echo ""
    print_status "Deployment Information:"
    kubectl get all -n $NAMESPACE
    
    echo ""
    print_status "To access the application:"
    print_status "kubectl port-forward service/${APP_NAME}-service -n $NAMESPACE 8080:80"
    print_status "Then visit: http://localhost:8080"
}

# Run main function
main "$@"
