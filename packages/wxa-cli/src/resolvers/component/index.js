import DependencyResolver from '../../helpers/dependencyResolver';
import PathParser from '../../helpers/pathParser';
import logger from '../../helpers/logger';
import {isFile} from '../../utils';

export default class ComponentManager {
    constructor(resolve, meta) {
        this.resolve = resolve;
        this.meta = meta;

        this.extensions = ['.wxml', '.wxss', '.js', '.json'];
    }

    parse(mdl) {
        if (mdl.json == null) return [];

        if (
            mdl.json.usingComponents ||
            Object.keys(mdl.json.usingComponents).length === 0
        ) {
            return [];
        }

        let childNodes = this.resolveComponents(mdl.json.usingComponents, mdl);

        return childNodes;
    }

    resolveComponents(coms, mdl) {
        return Object.keys(coms).reduce((ret, alias)=>{
            let com = coms[alias];
            let dr = new DependencyResolver(this.resolve, this.meta);

            try {
                let {source, pret} = dr.$resolve(com, mdl);
                let outputPath = dr.getOutputPath(source, pret, mdl);
                let resolved = dr.getResolved(com, source, mdl);

                if (pret.isPlugin || pret.isURI) return ret;

                // check if wxa file.
                if (isFile(source+this.meta.wxaExt)) {
                    ret.push({
                        src: source+this.meta.wxaExt,
                        category: 'Component',
                        pret,
                        sourceType: 'wxa',
                    });
                } else {
                    this.extensions.forEach((ext)=>{
                        let src = source+ext;
                        if (isFile(src)) {
                            ret.push({
                                src,
                                pret,
                                meta: {
                                    source: src, outputPath,
                                },
                            });
                        } else if (ext === '.json') {
                            logger.warn(alias+'组件不存在json配置文件');
                        }
                    });
                }

                coms[alias] = resolved;
            } catch (e) {
                logger.warn(e);
                return ret;
            }
        }, []);
    }

    findComponentSource(com, mdl) {
    }
}
