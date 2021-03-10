(function() {
	'use strict';

	Polymer({
		is: 'bah-infor-integration',

		properties: {
			/*
			 * eAndon <-> Infor mapping object
			 * Contains indexed unique id, alert definition id, and integration id
			 */
			integrations: {
				type: Object,
				observer: '_doMapping'
			},

			/*
			 * Integration objects with full data_map filtered by anchor id
			 */
			_integrationsForSite: {
				type: Array,
				value: []
			},

			/**
			 * Track loading of data to control visibility of tables
			 */
			isLoading: {
				type: Boolean,
				value: true
			},

			/**
			 * Name for the integration instance
			 */
			integrationName: {
				type: String,
				value: ''
			},

			/**
			 * Organization code for the integration
			 */
			orgCode: {
				tpye: String,
				value: ''
			},

			/**
			 * The selected site from the site selector
			 */
			selectedSite: {
				type: Object,
				observer: '_siteChange'
			},

			rootUrl: {
				type: String,
				value: '/eandon/integration'
			},

			token: {
				type: String
			},
			/**
			 * All alert definitions for a selected site
			 */
			unmappedAlertDefinitions: {
				type: Array,
				observer: '_mapAlertDefinitions'
			},
			/**
			 * All alert definitions for a selected site
			 */
			unmappedLocations: {
				type: Array,
				observer: '_mapLocations'
			},

			/*
			 * List of edited alert definitions
			 * This will tell us which rows to save and which to ignore
			 */
			_updatedAlertDefinitions: {
				type: Array,
				value: []
			},

			/*
			 * Mapped the incoming object to have the correct table data
			 * Filtered out ID and Value pairs
			 */
			mappedAlertDefinitions: {
				type: Array,
				value: []
			},
			_mappedAlertDefinitions: {
				type: Array,
				value: []
			}
		},

		listeners: {
			'save': '_forcePagination'
		},

		get departmentPlaceholder() {
			return 'Enter Department';
		},

		get equipmentCodePlaceholder() {
			return 'Enter Equipment Code';
		},

		get integrationPlaceholder() {
			return [];
		},

		/*
		 * When alert definitions are injected, map them if we have all data
		 */
		_mapAlertDefinitions: function(data) {
			this._doMapping();
		},

		/*
		 * Context browser changes
		 */
		_siteChange: function(data) {
			this.unmappedAlertDefinitions = [];
			this.unmappedLocations = [];
			this.isLoading = true;
			this._doMapping();
		},
		/*
		 * When locations are injected, map the alert definitions if we have all data
		 * We need this to look up location name for table from the guid
		 */
		_mapLocations: function(data) {
			this._doMapping();
		},

		dispatchCustomEvent(eventType, detail) {
			this.dispatchEvent(new CustomEvent(eventType, {detail}));
		},

		getIntegrationNameValue() {
			return document.getElementById('inforNameInput').value;
		},

		getOrgCodeValue() {
			return document.getElementById('orgCode').value;
		},

		isInputValueValid(inputValue, errorElementId) {
			const errorElement = document.getElementById(errorElementId);

			if (inputValue.length == 0) {
				errorElement.style.display = 'block';
				return false;
			} else {
				errorElement.style.display = 'none';
				return true;
			}
		},

		isIntegrationFormValid() {
			const isIntegationNameValid = this.isInputValueValid(this.getIntegrationNameValue(), 'int-name-error');
			const isOrgCodeValuevalid = this.isInputValueValid(this.getOrgCodeValue(), 'org-code-error');

			return isIntegationNameValid && isOrgCodeValuevalid;
		},

		getInitialsMappingsToSave() {
			return {
				mappingsToCreate: [],
				mappingsToUpdate: [],
				errors: [],

				hasItems() {
					return (this.mappingsToCreate.length > 0) || (this.mappingsToUpdate.length > 0);
				},

				hasErrors() {
					return (this.errors.length > 0);
				}
			};
		},

		getTableData() {
			return document.getElementById('integrationMappingTable').tableData;
		},

		getOrgCodeParameter() {
			return {
				'name': 'Organization Code',
				'type': 'alphanumeric',
				'scope': 'integration',
				'value': this.getOrgCodeValue(),
				'active': true,
				'parameter_name': 'orgCode'
			};
		},

		getMappingDataMapForRow(row) {
			return [
				this.getOrgCodeParameter(),
				{
					'id': 'department',
					'type': 'alphanumeric',
					'name': 'Department',
					'value': row.department,
					'scope': 'action',
					'parameter_name': 'department'
				},
				{
					'id': 'equipmentCode',
					'type': 'alphanumeric',
					'name': 'Equipment Code',
					'value': row.equipmentCode,
					'scope': 'action',
					'parameter_name': 'equipmentCode'
				}
			];
		},

		areEditableRowFieldsFilled(row) {
			return row.department !== this.departmentPlaceholder &&
				row.equipmentCode !== this.equipmentCodePlaceholder;
		},

		isRowHavingPendingChanges(row) {
			return _.includes(this._updatedAlertDefinitions, row.alertDefinitionId);
		},

		isRowEditedAndValid(row) {
			return this.areEditableRowFieldsFilled(row) && this.isRowHavingPendingChanges(row);
		},

		isRowHavingSavedMapping(row) {
			return !!row.integrationFlag;
		},

		getIntegrationOrMappingBodyWithDataMap(data_map) {
			const name = this.getIntegrationNameValue();

			return {
				name,
				system_id: 1,
				action_id: 4,
				data_map,
				system_anchor_id: this.selectedSite.id
			};
		},

		getMappingBodyForRow(row) {
			const dataMap = this.getMappingDataMapForRow(row);
			return this.getIntegrationOrMappingBodyWithDataMap(dataMap);
		},

		markRowAsProcessed(row) {
			const alertDefinitionIndex = this._updatedAlertDefinitions.indexOf(row.alertDefinitionId);
			this._updatedAlertDefinitions.splice(alertDefinitionIndex, 1);
		},

		getRowAsMappingToUpdate(row) {
			const { alertDefinitionId, alertDefinitionName } = row;
			const body = this.getMappingBodyForRow(row);

			let integrationId;
			try {
				integrationId = this.integrations[alertDefinitionId][0].integrationId;
			} catch (e) {
				console.error(`Could not get integration id for updating 
				alertDefinitionName='${alertDefinitionName}', alertDefinitionId=${alertDefinitionId}. 
				This Alert definition may be assigned to other integration.`);
				return null;
			}

			return {
				alertDefinitionId,
				alertDefinitionName,
				integrationId,
				body
			};
		},

		getRowAsMappingToCreate(row) {
			const { alertDefinitionId, alertDefinitionName } = row;
			const body = this.getMappingBodyForRow(row);

			return {
				alertDefinitionId,
				alertDefinitionName,
				body
			};
		},

		processRowToUpdateMapping(row, mappingToSave) {
			const mapping = this.getRowAsMappingToUpdate(row);

			if (mapping) {
				row.integration = mapping.body.data_map;
				mappingToSave.mappingsToUpdate.push(mapping);
			} else {
				mappingToSave.errors.push(row.alertDefinitionId);
			}
		},

		processRowToCreateMapping(row, mappingToSave) {
			const mapping = this.getRowAsMappingToCreate(row);
			row.integration = mapping.body.data_map;
			mappingToSave.mappingsToCreate.push(mapping);
		},

		processRow(row, mappingToSave) {
			if (this.isRowHavingSavedMapping(row)) {
				this.processRowToUpdateMapping(row, mappingToSave);
			} else {
				this.processRowToCreateMapping(row, mappingToSave);
			}
		},

		getMappingsToSave() {
			const mappingsToSave = this.getInitialsMappingsToSave();

			this.getTableData()
				.filter(row => this.isRowEditedAndValid(row))
				.forEach(row => {
					this.processRow(row, mappingsToSave);
					this.markRowAsProcessed(row);
				});

			return mappingsToSave;
		},

		saveMappings(mappingToSave) {
			this.dispatchCustomEvent('saveInforMappings', mappingToSave);
		},

		getIntegrationDataMap() {
			return [this.getOrgCodeParameter()];
		},

		getIntegrationBody() {
			const dataMap = this.getIntegrationDataMap();
			return this.getIntegrationOrMappingBodyWithDataMap(dataMap);
		},

		saveIntegration() {
			const body = this.getIntegrationBody();
			this.dispatchCustomEvent('saveInforIntegration', { body });
		},

		markAllRowUpdatesAsProcessed() {
			this._updatedAlertDefinitions = [];
		},

		discardRowUpdates() {
			this.markAllRowUpdatesAsProcessed();
		},

		saveIntegrationAfterValidation() {
			const mappingToSave = this.getMappingsToSave();

			if (mappingToSave.hasItems()) {
				this.saveMappings(mappingToSave);
			} else if (!mappingToSave.hasErrors()) {
				this.saveIntegration();
			} else {
				console.error(`Could not save integration or mappings, as there are no valid items to save, only erroneous ones`);
			}

			this.markAllRowUpdatesAsProcessed();
		},

		_saveIntegrations() {
			if (!this.isIntegrationFormValid()) {
				this.discardRowUpdates();
			} else {
				this.saveIntegrationAfterValidation();
			}
		},

		markAlertDefinitionIntegrationMappingSaved(alertDefinitionId) {
			const alertDefinition = _.find(this.unmappedAlertDefinitions, {'id': alertDefinitionId});

			if (alertDefinition) {
				alertDefinition.integrationId = 1;
			} else {
				console.error(`Could not find Alert definition with id=${alertDefinitionId} to toggle integration flag.`)
			}
		},

		onIntegrationSaved() {
		},

		onIntegrationSaveFailed() {
		},

		onAllMappingSavesFinished() {
			console.log('onAllMappingSavesFinished');
		},

		onMappingCreated({ alertDefinitionId }) {
			this.markAlertDefinitionIntegrationMappingSaved(alertDefinitionId);
		},

		onMappingCreateFailed({ alertDefinitionId }) {
		},

		updateIntegrationId(alertDefinitionId, integrationId) {
			const integrationsForAlertDef = this.integrations[alertDefinitionId];

			if (integrationsForAlertDef && integrationsForAlertDef[0]) {
				integrationsForAlertDef[0].integrationId = integrationId;
			} else {
				console.error(`Could not update integrationId for alertDefinitionId=${alertDefinitionId}`);
			}
		},

		onMappingUpdated({ alertDefinitionId, integrationId }) {
			this.updateIntegrationId(alertDefinitionId, integrationId);
		},

		onMappingUpdateFailed({ alertDefinitionId }) {
		},

		onBeforeHide() {
			this.discardRowUpdates();
		},

		getDataMapItem(intObj, expression) {
			return _.find(intObj.data_map,
					item => ((item.id === expression) || (item.parameter_name === expression)));
		},

		/*
		 * Main mapping function to populate table data
		 * Will only execute when alert definitions, locations, and integrations have loaded
		 */
		_doMapping: function() {
			// make sure all data is loaded
			if (this.unmappedAlertDefinitions &&
				this.unmappedAlertDefinitions.length > 0 &&
				this.unmappedLocations &&
				this.unmappedLocations.length > 0 &&
				this.integrations !== {}) {
				// maintain scope of our variables
				var _this = this;

				var integrationServ = document.querySelector('#integrationService');
				integrationServ.getIntegrationsBySystemAnchorId(_this.selectedSite.id).then((integrations) => {
					_this.mappedAlertDefinitions = [];
					// Store this into our polymer attribute
					_this.integrationsForSite = integrations;
					// Populate the name and org code for this site (assumption: 1 per site)
					document.getElementById('inforNameInput').value = _this.integrationName;
					document.getElementById('orgCode').value = _this.orgCode;
					_.forEach(this.unmappedAlertDefinitions, function(value) {
						// Based on the location ID of this alert definition,
						// find the location name from our other obj
						var location = _.find(_this.unmappedLocations, { 'id': value.locationId });
						if (!location) {
							return;
						}
						var locName = location.name;
						var department = _this.departmentPlaceholder;
						var equipmentCode = _this.equipmentCodePlaceholder;
						var integration = _this.integrationPlaceholder;
						try {
							// check to see if this alert definition has an integration or not
							if (value.integrationId === 1) {
								// if its does, grab the integrtation from the hash map
								var obj = _this.integrations[value.id];
								// find the object in the integrations array for this site
								var intObj = _.find(_this.integrationsForSite, { 'id': obj[0].integrationId });

								const departmentItem = _this.getDataMapItem(intObj, 'department');
								if (departmentItem) {
									department = departmentItem.value;
								}

								const equipmentCodeItem = _this.getDataMapItem(intObj, 'equipmentCode');
								if (equipmentCodeItem) {
									equipmentCode = equipmentCodeItem.value;
								}

								// Populate the integration object with the correct value
								integration = intObj.data_map;
							}
						} catch (e) {
							console.error(`Error mapping integration details for alertDefinitionId=${value.id}, alertDefinitionName=${value.name}`);
						}
						// Push this element into our mapped table data
						_this.mappedAlertDefinitions.push(
							{
								'alertTypeName': value.alertType.name,
								'alertTypeId': value.alertType.id,
								'alertDefinitionId': value.id,
								'alertDefinitionName': value.name,
								'locationId': value.locationId,
								'locationName': locName,
								'department': department,
								'equipmentCode': equipmentCode,
								'integration': integration,
								'integrationFlag': value.integrationId
							});
					});
					_this.set('_mappedAlertDefinitions', _this.mappedAlertDefinitions);
					this.isLoading = false;
				}).catch(error => {
					this.isLoading = false;
					const message = 'Error loading integrations for site';
					this.$.bahUtility.alert('Error', message);
					console.error(message, error);
				});
			}
		},

		_forcePagination: function(e) {
			// get the index of the row clicked
			const indexClicked = e.model.__data__.internalRow.row.dataIndex;
			// Get the size of the pagination of the table
			const pageSize = document.querySelectorAll('px-pagination')[1].pageSize;
			// Get the current page based on the index the user selected
			const page = (indexClicked + 1) / pageSize;
			// force pagination to be at that page
			document.querySelectorAll('px-pagination')[1].goToPageNumber(Math.ceil(page));

			const alertDefinitionId = this.mappedAlertDefinitions[indexClicked].alertDefinitionId;
			const isRowAlreadyEdited = _.includes(this._updatedAlertDefinitions, alertDefinitionId);

			if (!isRowAlreadyEdited) {
				this._updatedAlertDefinitions.push(alertDefinitionId);
			}

			this.dispatchEvent(new CustomEvent('dataEdited', {detail: true}));
		},

	});
})();
