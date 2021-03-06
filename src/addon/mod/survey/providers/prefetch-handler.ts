// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable, Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CoreAppProvider } from '@providers/app';
import { CoreFilepoolProvider } from '@providers/filepool';
import { CoreSitesProvider } from '@providers/sites';
import { CoreDomUtilsProvider } from '@providers/utils/dom';
import { CoreUtilsProvider } from '@providers/utils/utils';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreCourseActivityPrefetchHandlerBase } from '@core/course/classes/activity-prefetch-handler';
import { AddonModSurveyProvider } from './survey';
import { AddonModSurveySyncProvider } from './sync';
import { AddonModSurveyHelperProvider } from './helper';
import { CoreFilterHelperProvider } from '@core/filter/providers/helper';
import { CorePluginFileDelegate } from '@providers/plugin-file-delegate';

/**
 * Handler to prefetch surveys.
 */
@Injectable()
export class AddonModSurveyPrefetchHandler extends CoreCourseActivityPrefetchHandlerBase {
    name = 'AddonModSurvey';
    modName = 'survey';
    component = AddonModSurveyProvider.COMPONENT;
    updatesNames = /^configuration$|^.*files$|^answers$/;

    protected syncProvider: AddonModSurveySyncProvider; // It will be injected later to prevent circular dependencies.

    constructor(translate: TranslateService,
            appProvider: CoreAppProvider,
            utils: CoreUtilsProvider,
            courseProvider: CoreCourseProvider,
            filepoolProvider: CoreFilepoolProvider,
            sitesProvider: CoreSitesProvider,
            domUtils: CoreDomUtilsProvider,
            filterHelper: CoreFilterHelperProvider,
            pluginFileDelegate: CorePluginFileDelegate,
            protected surveyProvider: AddonModSurveyProvider,
            protected surveyHelper: AddonModSurveyHelperProvider,
            protected injector: Injector) {

        super(translate, appProvider, utils, courseProvider, filepoolProvider, sitesProvider, domUtils, filterHelper,
                pluginFileDelegate);
    }

    /**
     * Returns survey intro files.
     *
     * @param module The module object returned by WS.
     * @param courseId Course ID.
     * @return Promise resolved with list of intro files.
     */
    getIntroFiles(module: any, courseId: number): Promise<any[]> {
        return this.surveyProvider.getSurvey(courseId, module.id).catch(() => {
            // Not found, return undefined so module description is used.
        }).then((survey) => {
            return this.getIntroFilesFromInstance(module, survey);
        });
    }

    /**
     * Invalidate the prefetched content.
     *
     * @param moduleId The module ID.
     * @param courseId Course ID the module belongs to.
     * @return Promise resolved when the data is invalidated.
     */
    invalidateContent(moduleId: number, courseId: number): Promise<any> {
        return this.surveyProvider.invalidateContent(moduleId, courseId);
    }

    /**
     * Invalidate WS calls needed to determine module status.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @return Promise resolved when invalidated.
     */
    invalidateModule(module: any, courseId: number): Promise<any> {
        return this.surveyProvider.invalidateSurveyData(courseId);
    }

    /**
     * Whether or not the handler is enabled on a site level.
     *
     * @return A boolean, or a promise resolved with a boolean, indicating if the handler is enabled.
     */
    isEnabled(): boolean | Promise<boolean> {
        return true;
    }

    /**
     * Prefetch a module.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @param single True if we're downloading a single module, false if we're downloading a whole section.
     * @param dirPath Path of the directory where to store all the content files.
     * @return Promise resolved when done.
     */
    prefetch(module: any, courseId?: number, single?: boolean, dirPath?: string): Promise<any> {
        return this.prefetchPackage(module, courseId, single, this.prefetchSurvey.bind(this));
    }

    /**
     * Prefetch a survey.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @param single True if we're downloading a single module, false if we're downloading a whole section.
     * @param siteId Site ID.
     * @return Promise resolved when done.
     */
    protected prefetchSurvey(module: any, courseId: number, single: boolean, siteId: string): Promise<any> {
        return this.surveyProvider.getSurvey(courseId, module.id, true, siteId).then((survey) => {
            const promises = [],
                files = this.getIntroFilesFromInstance(module, survey);

            // Prefetch files.
            promises.push(this.filepoolProvider.addFilesToQueue(siteId, files, AddonModSurveyProvider.COMPONENT, module.id));

            // If survey isn't answered, prefetch the questions.
            if (!survey.surveydone) {
                promises.push(this.surveyProvider.getQuestions(survey.id, true, siteId));
            }

            return Promise.all(promises);
        });
    }

    /**
     * Sync a module.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to
     * @param siteId Site ID. If not defined, current site.
     * @return Promise resolved when done.
     */
    sync(module: any, courseId: number, siteId?: any): Promise<any> {
        if (!this.syncProvider) {
            this.syncProvider = this.injector.get(AddonModSurveySyncProvider);
        }

        return this.syncProvider.syncSurvey(module.instance, undefined, siteId);
    }
}
