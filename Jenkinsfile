def version() {
  def isStg = (BRANCH_NAME =~ /^(heads\/)?\d{1,4}\.\d{1,4}\.\d{1,5}(\+hotfix\.\d{1,3})?/)
  def env = (BUILD_ENV == 'ci1') ? 'ci' : 'dev'
  isStg ? BRANCH_NAME : env
}

pipeline {
  agent { label '!master' }
  tools {
    nodejs 'node12'
    maven 'maven221'
  }
  parameters {
    string(
      defaultValue: "ci1",
      description: 'Environment to build and deploy to. Supports regex: dev.* dev1|dev4',
      name: 'BUILD_ENV'
    )
  }
  environment {
    BUILD_ENV = "${params.BUILD_ENV}"
    BUILD_INSTANCE = "${env.BUILD_ENV == 'dev1' ? 'dapi1' : 'webapi1'}"
    BUILD_NUMBER = "${currentBuild.startTimeInMillis}~${currentBuild.number}"
    BUILD_DATE = sh(
      script: 'echo $(date -R)',
      returnStdout: true
    ).trim()
    GIT_OWNER = "dynamicaction"
    GIT_REPO = "flok"
    GIT_SOURCE = "https://github.com/${GIT_OWNER}/${GIT_REPO}"
    GIT_COMMIT = sh(
      script: 'git describe --always',
      returnStdout: true
    ).trim()
    GIT_BRANCH = sh(
      script: 'git rev-parse --abbrev-ref HEAD',
      returnStdout: true
    ).trim()
  }

  stages {

    stage("parameterizing") {
      when {
        expression {
          def v = version();
          return v == 'ci' || v == 'dev'
        }
      }
      steps {
        script {
          echo "deploying on " + BUILD_ENV + " branch: " + GIT_BRANCH
          if (BUILD_ENV == "ci1" && GIT_BRANCH != "master") {
            currentBuild.result = 'ABORTED'
            error('DRY RUN COMPLETED. JOB PARAMETERIZED.')
          }
        }
      }
    }

    stage('Prepare') {
      steps {
        sh 'make dev'
      }
    }

    stage('Build') {
      parallel {
        stage('test') {
          steps {
            sh 'make test'
          }
        }
        stage('lint') {
          steps {
            sh 'make lint'
          }
        }
      }
    }

    stage('Package') {
      steps {
        sh 'npm prune --production'
        sh """
          mvn clean package rpm:rpm  \
            -Drpmversion=${version()} \
            -Drpmrelease=${BUILD_NUMBER} \
            -Dgit_commit=${GIT_COMMIT} \
            -Dgit_source=${GIT_SOURCE}
        """
      }
    }

    stage('DeployDev') {
      when {
        expression {
          def v = version();
          return v == 'ci' || v == 'dev'
        }
      }
      steps {
        sshPublisher alwaysPublishFromMaster: true, continueOnError: true, publishers: [
          sshPublisherDesc(
            configName: 'shared_repo',
            sshLabel: [label: "$BUILD_ENV"],
            transfers: [
              sshTransfer(
                cleanRemote: false,
                excludes: '',
                execCommand: "createrepo_c --update /srv/yum/shared/x86_64",
                execTimeout: 300000,
                flatten: false,
                makeEmptyDirs: false,
                noDefaultExcludes: false,
                patternSeparator: '[, ]+',
                remoteDirectory: "x86_64",
                remoteDirectorySDF: false,
                removePrefix: 'target/rpm/flok/RPMS/x86_64/',
                sourceFiles: 'target/rpm/flok/RPMS/x86_64/*.rpm'
              )
            ],
            usePromotionTimestamp: false,
            useWorkspaceInPromotion: false,
            verbose: true
          ),
          sshPublisherDesc(
            configName: "${BUILD_INSTANCE}.${BUILD_ENV}",
            sshLabel: [label: BUILD_ENV],
            sshRetry: [
              retries: 2,
              retryDelay: 10000
            ],
            transfers: [
              sshTransfer(
                cleanRemote: false,
                excludes: '',
                execCommand: '''
                  sudo yum clean all
                  E=$?;
                  if [[ $E -ne 0 ]]
                  then
                          echo "Cleaning up yum cache error!"
                          exit $E
                  fi
                  sudo puppet agent -ot --color=false --no-noop;
                  E=$?;
                  if [[ $E -eq 1 ]]
                  then
                          echo "Run of Puppet configuration client already in progress; sleeping 90 sec"
                          sleep 90
                          sudo puppet agent -ot --color=false --no-noop;
                          E=$?;
                  fi

                  if [[ $E -eq 2 ]]
                  then
                          echo "All changes were deployed"
                          exit 0
                  fi
                  if [[ $E -eq 0 ]]
                  then
                          echo "There were no changes for deployment"
                          exit 0
                  fi
                  echo "There were failures during the transaction"
                  exit $E
                ''',
                execTimeout: 120000,
                flatten: true,
                makeEmptyDirs: false,
                noDefaultExcludes: false,
                patternSeparator: '[, ]+',
                remoteDirectory: '',
                remoteDirectorySDF: false,
                removePrefix: '',
                sourceFiles: '',
                usePty: true
              )
            ],
            usePromotionTimestamp: false,
            useWorkspaceInPromotion: false,
            verbose: false
          ),
        ]
        script {
          def description = "Deploying ${GIT_BRANCH} to ${BUILD_ENV}"
          def deployURL = "https://api.github.com/repos/${GIT_OWNER}/${GIT_REPO}/deployments"
          def deployBody = '{"ref": "' + GIT_COMMIT +'","environment": "' + BUILD_ENV  +'","description": "' + description + '","auto_merge":false,"required_contexts":[]}'

          // Create new Deployment using the GitHub Deployment API
          def response = httpRequest authentication: 'github-deployment-token', httpMode: 'POST', requestBody: deployBody, responseHandle: 'STRING', url: deployURL

          if(response.status != 201) {
              error("Deployment API Create Failed: " + response.status)
          }

          // Get the ID of the GitHub Deployment just created
          def responseJson = readJSON text: response.content
          def id = responseJson.id

          if(id == "") {
              error("Could not extract id from Deployment response")
          }

          // At this point we need to get the status of sshPublisher
          //def result = (deployStatus) ? 'failure' : 'success'
          def deployStatusBody = '{"state": "' + "success" + '","target_url": "https://' + BUILD_ENV + '.dynamicaction.com"}'
          def deployStatusURL = "https://api.github.com/repos/${GIT_OWNER}/${GIT_REPO}/deployments/${id}/statuses"
          def deployStatusResponse = httpRequest authentication: 'github-deployment-token', httpMode: 'POST', requestBody: deployStatusBody , responseHandle: 'STRING', url: deployStatusURL

          if(deployStatusResponse.status != 201) {
            error("Deployment Status API Update Failed: " + deployStatusResponse.status)
          }
        }
      }
    }

    stage('DeployStg') {
      when {
        expression {
          def v = version();
          return v != 'ci' && v != 'dev'
        }
      }
      steps {
        sshPublisher alwaysPublishFromMaster: true, continueOnError: true, publishers: [
          sshPublisherDesc(
            configName: 'shared_repo',
            sshLabel: [label: "$BUILD_ENV"],
            transfers: [
              sshTransfer(
                cleanRemote: false,
                excludes: '',
                flatten: false,
                makeEmptyDirs: false,
                noDefaultExcludes: false,
                patternSeparator: '[, ]+',
                remoteDirectory: "pending/stg/x86_64",
                remoteDirectorySDF: false,
                removePrefix: 'target/rpm/flok/RPMS/x86_64/',
                sourceFiles: 'target/rpm/flok/RPMS/x86_64/*.rpm'
              )
            ],
            usePromotionTimestamp: false,
            useWorkspaceInPromotion: false,
            verbose: true
          )
        ]
      }
    }

  }
}
