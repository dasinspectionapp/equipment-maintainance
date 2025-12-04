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
                sh 'docker compose -f docker-compose.staging.yml down --remove-orphans'
                sh 'docker compose -f docker-compose.staging.yml up -d --build'
            }
        }

        stage('Approval For Production Release') {
            steps {
                input(message: "Deploy to Production?")
            }
        }

        stage('Deploy Production') {
            steps {
                sh 'docker compose -f docker-compose.prod.yml down --remove-orphans'
                sh 'docker compose -f docker-compose.prod.yml up -d --build'
            }
        }
    }
}
