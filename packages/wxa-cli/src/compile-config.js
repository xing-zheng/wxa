import {getDistPath, writeFile, readFile, error, isFile, warn} from './utils';
import {info} from './utils';
import path from 'path';
import {AsyncSeriesHook} from 'tapable';
import PathParser from './helpers/pathParser';
import findRoot from 'find-root';

class CConfig {
    constructor(src, dist) {
        this.current = process.cwd();
        this.src = src || 'src';
        this.dist = dist || 'dist';
        this.type = 'json';
        this.code = '';
        this.modulesPath = path.join(this.current, 'node_modules', path.sep);
        this.localVisualPath = path.join(this.current, 'local', path.sep);
        this.npmPath = path.join(this.current, dist, 'npm', path.sep);
        this.localPath = path.join(this.current, dist, 'local', path.sep);
        this.hooks = {
            optimizeAssets: new AsyncSeriesHook(['code', 'compilation']),
        };
    }

    copyComponents(com, isNpm=true) {
        let extOfCom = ['.wxml', '.wxss', '.js', '.json'];

        extOfCom.forEach((ext)=>{
            let uri = isNpm ? path.join(this.modulesPath, com, ext) : com+path.sep+ext;

            if (isFile(uri)) {
                let target;
                if (isNpm) {
                    target = path.join(this.npmPath, com);
                } else {
                    target = path.join(this.localPath, path.parse(com).base);
                }
                info(`write ${isNpm ? 'npm' : 'local'} com`, path.relative(this.current, target));
                writeFile(target, readFile(uri));
            } else if (ext === '.json') {
                warn(com+'组件不存在json配置文件');
            }
        });
    }

    resolveComponents(code, opath) {
        if (!code.usingComponents) return code;

        let coms = code.usingComponents;
        Object.keys(coms).forEach((key)=>{
            let com = code.usingComponents[key];
            let pret = new PathParser().parse(com);
            if (pret.isNodeModule || pret.isAbsolute) {
                // copy npm or local components, generate new path;
                this.copyComponents(com, pret.isNodeModule);
                let resolved = path.join(path.relative(opath.dir, pret.isNodeModule ? this.modulesPath : this.localVisualPath), com);
                coms[key] = resolved;
            }
        });
        code.usingComponents = coms;
        return code;
    }

    compile(content, opath) {
        if (content == null) {
            content = readFile(path.join(opath.dir, opath.base));
            if (content == null) throw new Error('打开文件失败 ', path.join(opath.dir, opath.base));
        }
        try {
            content = JSON.parse(content);
            // 编译组件
            content = this.resolveComponents(content, opath);
        } catch (e) {
            error('config有误, 请检查格式');
            error(e);
            return Promise.reject(e);
        }

        this.code = JSON.stringify(content, void(0), 4);
        return this.hooks.optimizeAssets.promise(content, this).then((err)=>{
            if (err) return Promise.reject(err);
            let target = getDistPath(opath, 'json', this.src, this.dist);
            info('Config', path.relative(this.current, target));
            writeFile(target, this.code);
        }).catch((e)=>console.error(e, content));
    }
}

export default CConfig;
