pipeline {
    agent any

    stages {

        stage('Checkout Code') {
            steps {
                git(
                    branch: 'main',
                    credentialsId: 'github-token',
                    url: 'https://github.com/dasinspectionapp/equipment-maintainance.git'
                )
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
                    // Forcefully remove existing containers if they exist
                    sh '''
                        docker rm -f backend-staging frontend-staging 2>/dev/null || true
                        docker compose -f docker-compose.staging.yml down --remove-orphans -v || true
                    '''
                    sh 'docker compose -f docker-compose.staging.yml up -d --build'
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
                    // Forcefully remove existing containers if they exist
                    sh '''
                        docker rm -f backend-prod frontend-prod 2>/dev/null || true
                        docker compose -f docker-compose.prod.yml down --remove-orphans -v || true
                    '''
                    sh 'docker compose -f docker-compose.prod.yml up -d --build'
                }
            }
        }
    }
}
