pipeline {
    agent any

    // Without this, Git checkout runs before any stage and fails if Docker left root-owned
    // files under WORKSPACE (bind mounts for uploads/config).
    options {
        skipDefaultCheckout(true)
    }

    // Production Firebase keys: host path outside WORKSPACE (set in Jenkins job env to override).
    environment {
        DAS_PROD_CONFIG_HOST = "${env.DAS_PROD_CONFIG_HOST != null && env.DAS_PROD_CONFIG_HOST != '' ? env.DAS_PROD_CONFIG_HOST : '/var/lib/dasequipment-data/prod/config'}"
    }

    stages {

        stage('Checkout') {
            steps {
                sh '''
                    set -e
                    # Stop containers that bind-mount into WORKSPACE (releases mounts so deletes/chown work).
                    docker rm -f backend-staging frontend-staging backend-prod frontend-prod 2>/dev/null || true

                    if [ -z "${WORKSPACE:-}" ] || [ ! -d "${WORKSPACE}" ]; then
                        echo "WORKSPACE not available"; exit 1
                    fi

                    # Fix root:root files from old Docker bind mounts without host sudo: chown from a root container.
                    JU=$(id -u)
                    JG=$(id -g)
                    docker run --rm \
                        -e JU="$JU" -e JG="$JG" \
                        -v "${WORKSPACE}:/ws" \
                        alpine:3.20 \
                        sh -c 'chown -R "${JU}:${JG}" /ws'
                '''
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Build Frontend') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Deploy Staging') {
            steps {
                script {
                    // -p isolates this stack from prod (same folder default project name was tearing down staging on prod deploy).
                    sh '''
                        docker rm -f backend-staging frontend-staging 2>/dev/null || true
                        docker compose -p das-equipment-staging -f docker-compose.staging.yml down --remove-orphans || true
                    '''
                    sh 'docker compose -p das-equipment-staging -f docker-compose.staging.yml up -d --build'
                }
            }
        }

        stage('Approval For Production Release') {
            steps {
                input(message: "Deploy to Production?")
            }
        }

        stage('Deploy Production') {
            steps {
                script {
                    // Ensure prod config dir exists (secrets must exist here — see comment below).
                    sh '''
                        mkdir -p "${DAS_PROD_CONFIG_HOST}"
                    '''
                    // Forcefully remove existing containers if they exist
                    sh '''
                        docker rm -f backend-prod frontend-prod 2>/dev/null || true
                        docker compose -p das-equipment-prod -f docker-compose.prod.yml down --remove-orphans || true
                    '''
                    sh 'docker compose -p das-equipment-prod -f docker-compose.prod.yml up -d --build'
                }
            }
        }
    }
}
